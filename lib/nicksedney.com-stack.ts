import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloundfront from 'aws-cdk-lib/aws-cloudfront';
import * as cforigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

interface NicksedneyComStackProps extends cdk.StackProps {
  // Certificate must be created in `us-east-1` - so needs to be created in a different stack and passed in.
  nicksedneyCert: acm.Certificate;
}

export class NicksedneyComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: NicksedneyComStackProps) {
    super(scope, id, { ...props });

    /// Create nicksedney.com static website
    // Create S3 bucket to host the site's logs
    const accessLogsBucket = new s3.Bucket(this, 'nicksedneyAccessLogsBucket', {
      bucketName: "nicksedney.com-access-logs",
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(14) }
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    // Create S3 bucket to host the site's content
    const nicksedneyBucket = new s3.Bucket(this, "nicksedneybucket", {
      bucketName: "nicksedney.com",
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'nicksedney.com/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    // Retrieve HostedZone where we configure DNS routing.  NOTE:
    //  The HostedZone itself must be created by hand - if we try to create in CDK we'll get random name servers that
    //  don't match registered domain: https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-replace-hosted-zone.html
    const nicksedneyHostedZone = route53.HostedZone.fromLookup(this, "nicksedneyzone", {
      domainName: "nicksedney.com"
    });
    // Get our HTTPS certificate
    const nickSedneyCert = props.nicksedneyCert;
    // Set up CloudFront Distribution for edge cacheing.
    const nicksedneyCloudfront = new cloundfront.Distribution(this, 'nicksedneyCfDistribution', {
      defaultBehavior: {
        origin: new cforigins.S3Origin(nicksedneyBucket),
        viewerProtocolPolicy: cloundfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      domainNames: ["nicksedney.com"],
      certificate: nickSedneyCert
    });
    // Route DNS traffic to CloudFront Distribution
    new route53.ARecord(this, "nickssedneyDNSRecord", {
      recordName: "nicksedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(nicksedneyCloudfront)
      ),
      zone: nicksedneyHostedZone
    });
    // Create S3 deployment to populate the bucket with website's content
    const deployment = new s3deployment.BucketDeployment(this, "nicksedneyDeployWebsite", {
      sources: [s3deployment.Source.asset("website")],
      destinationBucket: nicksedneyBucket,
      distribution: nicksedneyCloudfront // Invalidate CloudFront cache on deploy
    });
    // Create CloudFront function that redirects traffic to `nicksedney.com`
    const func = new cloundfront.Function(this, "nickSedneyRedirectFunc", {
      functionName: "nicksedneyRedirect",
      code: cloundfront.FunctionCode.fromInline(`
        function handler(event) {
          return {
            statusCode: 302,
            headers: {
               "location": { "value": "https://nicksedney.com" }
            }
          }
        }   
      `),
      runtime: cloundfront.FunctionRuntime.JS_2_0
    });
    // Create CloudFront distribution for endpoints that will redirect to nicksedney.com
    const redirectDistribution = new cloundfront.Distribution(this, 'nicksedneyRedirectDistribution', {
      defaultBehavior: {
        origin: new cforigins.HttpOrigin("site.invalid", {}),
        functionAssociations: [{
          function: func,
          eventType: cloundfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      domainNames: ["*.nicksedney.com",  "nsedney.com", "*.nsedney.com", "nicholassedney.com", "*.nicholassedney.com"],
      certificate: nickSedneyCert
    });
    // TODO: Tons of repeitition in here - time to learn to write some Constructs, or at least some helper functions ...
    // Redirects for nicksedney.com subdomains
    new route53.ARecord(this, "*.nickssedneyalias", {
      recordName: "*.nicksedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(redirectDistribution)
      ),
      zone: nicksedneyHostedZone
    });
    // Redirects for nsedney.com
    const nsedneyzone = route53.HostedZone.fromLookup(this, "nsedneyzone", { domainName: "nsedney.com" });
    new route53.ARecord(this, "nsedneyalias", {
      recordName: "nsedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(redirectDistribution)
      ),
      zone: nsedneyzone
    });
    new route53.ARecord(this, "*.nsedneyalias", {
      recordName: "*.nsedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(redirectDistribution)
      ),
      zone: nsedneyzone
    });
    // Redirects for nicholassedney.com
    const nicholassedneyzone = route53.HostedZone.fromLookup(this, "nicholassedneyzone", { domainName: "nicholassedney.com" });
    new route53.ARecord(this, "nicholassedneyalias", {
      recordName: "nicholassedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(redirectDistribution)
      ),
      zone: nicholassedneyzone
    });
    new route53.ARecord(this, "*.nicholassedneyalias", {
      recordName: "*.nicholassedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(redirectDistribution)
      ),
      zone: nicholassedneyzone
    });
  }
}
