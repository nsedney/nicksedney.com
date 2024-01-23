import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloundfront from 'aws-cdk-lib/aws-cloudfront';
import * as cforigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { DomainConfig } from './types';
import { DomainName } from 'aws-cdk-lib/aws-apigateway';

/**
 * Required args for a StaticWebsiteStack
 */
export interface StaticWebsiteStackProps extends cdk.StackProps {
  /** Domain under which website will display.  Any subdomains provided will redirect to the registered domain. */
  primaryDomain: DomainConfig,
  /** Any other supplied domains will redirect to the primary domain */
  redirectDomains?: DomainConfig[],
  /** Certificate must be created in `us-east-1`, and associated with all provided domains */
  websiteCert: acm.Certificate;
}

/**
 * Configures an S3-hosted website:
 *  * Creates buckets for the website's content and its logs
 *  * Creates a CloudFront distribution in front of the bucket to provide edge caching and HTTPS support
 *  * Configure a domain in Route53 to point to the new website
 *  * Configure other provided domains/subdomains to redirect to the primary website
 */
export class StaticWebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StaticWebsiteStackProps) {
    super(scope, id, { ...props });

    const primaryDomainName = props.primaryDomain.registeredDomain

    /**
     * Create S3-hosted static website for given `primaryDomain`
     */

    // Create S3 bucket to host the site's logs
    const accessLogsBucket = new s3.Bucket(this, `${primaryDomainName}_accessLogsBucket`, {
      bucketName: `${primaryDomainName}-access-logs`,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(14) }
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    // Create S3 bucket to host the site's content
    const websiteBucket = new s3.Bucket(this, `${primaryDomainName}_websiteBucket`, {
      bucketName: primaryDomainName,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: `${primaryDomainName}/`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    })

    // Retrieve HostedZone where we configure DNS routing.  NOTE:
    //  The HostedZone should have been created when registering the domain - if we try to create in CDK
    //  we'll get random name servers that don't match registered domain!
    //  If for some reason we need to recreate the zone, we can do so:
    //  https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-replace-hosted-zone.html
    const websiteHostedZone = route53.HostedZone.fromLookup(this, `${primaryDomainName}_hostedZone`, {
      domainName: primaryDomainName
    })

    // Set up CloudFront Distribution for edge cacheing.  Also handles HTTPS
    const websiteCloudfront = new cloundfront.Distribution(this, `${primaryDomainName}_cfDistribution`, {
      comment: `Distribution for ${primaryDomainName} website content`,
      defaultBehavior: {
        origin: new cforigins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloundfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      domainNames: [primaryDomainName],
      certificate: props.websiteCert
    })

    // Route DNS traffic to CloudFront Distribution
    new route53.ARecord(this, `${primaryDomainName}_dnsARecord`, {
      recordName: primaryDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(websiteCloudfront)
      ),
      zone: websiteHostedZone,

    })

    // Create S3 deployment to populate the websiteBucket with website's content
    const deployment = new s3deployment.BucketDeployment(this, `${primaryDomainName}_bucketDeployment`, {
      sources: [s3deployment.Source.asset("website")],
      destinationBucket: websiteBucket,
      distribution: websiteCloudfront // Invalidate CloudFront cache on deploy
    })

    /**
     * Now create redirects for all other domains we want to forward to primary domain
     */

    // TODO: some duplication here with Cert stack - figure out conventional Typescipt way to add some utility functions to our data Interface (or maybe just use a class?)
    const redirectDomains = props.redirectDomains ?? []
    const alternateDomainNames = [
      ...(props.primaryDomain.supportedSubdomains ?? []),
      ...redirectDomains.reduce(
        (accumulator, domain) => accumulator.concat([domain.registeredDomain, ...(domain.supportedSubdomains ?? [])]),
        [] as string[]
      )
    ]

    // TODO: This'd be a good place to learn how to build a `Construct`
    // Create CloudFront function that redirects traffic to primary domain
    const redirectFunction = new cloundfront.Function(this, `${primaryDomainName}_cfRedirectFunc`, {
      functionName: `${primaryDomainName.replace(".", "")}Redirect`,
      code: cloundfront.FunctionCode.fromInline(`
        function handler(event) {
          return {
            statusCode: 302,
            headers: {
               "location": { "value": "https://${primaryDomainName}" }
            }
          }
        }   
      `),
      runtime: cloundfront.FunctionRuntime.JS_2_0
    })

    // Create CloudFront distribution for endpoints that will redirect to primary domain
    const redirectDistribution = new cloundfront.Distribution(this, `${primaryDomainName}_cfRedirectDistribution`, {
      comment: `Distribution for domains redirecting to ${primaryDomainName}`,
      defaultBehavior: {
        origin: new cforigins.HttpOrigin("site.invalid", {}),
        functionAssociations: [{
          function: redirectFunction,
          eventType: cloundfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      domainNames: alternateDomainNames,
      certificate: props.websiteCert
    })

    /**
     * Create a DNS A record pointing provide domain to our cloudfront `redirect` function 
     * @param domainName - domain name to redirect
     * @param hostedZone - HostedZone configured for the provided domain
     * */
    const createRedirectRecord = (domainName: string, zone: route53.IHostedZone) => {
      new route53.ARecord(this, `${domainName}_dnsARecord`, {
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(redirectDistribution)
        ),
        zone: zone
      })
    }

    // Redirect subdomains in 'primary' domain
    props.primaryDomain.supportedSubdomains?.forEach((domain) => {
      createRedirectRecord(domain, websiteHostedZone)
    })

    // Redirect all other domains
    redirectDomains.forEach((domain) => {
      // Each DomainConfig should represent a single registered domain, with a single hosted zone.
      const hostedZone = route53.HostedZone.fromLookup(this, `${domain.registeredDomain}_hostedZone`, {
        domainName: domain.registeredDomain
      })

      // Create record of the SLD domain and all provided subdomains
      ;[domain.registeredDomain, ...(domain.supportedSubdomains ?? [])].forEach(domainName => {
        createRedirectRecord(domainName, hostedZone)
      })
    })

    /** Outputs */

    new cdk.CfnOutput(this, `${primaryDomainName}_urlOutput`, {
      value: `https://${ primaryDomainName} `,
      description: 'Primary URL for site navigation.',
      exportName: 'websiteUrl',
    });

    new cdk.CfnOutput(this, `${primaryDomainName}_redirectUrlsOutput`, {
      value: alternateDomainNames.map((domainName) => `https://${ domainName} `).join(",") ,
      description: 'Other URLs that should redirect to primary URL',
      exportName: 'websiteRedirectUrls',
    });
  }
}
