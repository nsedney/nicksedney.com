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
    // Create S3 deployment to populate the bucket with website's content
    const deployment = new s3deployment.BucketDeployment(this, "nicksedneyDeployWebsite", {
      sources: [s3deployment.Source.asset("website")],
      destinationBucket: nicksedneyBucket
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
    new route53.ARecord(this, "nickssedneyalias", {
      recordName: "nicksedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(nicksedneyCloudfront)
      ),
      zone: nicksedneyHostedZone
    });


    /// Configure other (sub)domains to redirect to nicksedney.com
    // TODO: Can we somehow do this w/out buckets now that cloudfront is involved?

    /// www.nicksedney.com
    // Empty bucket used purely to redirect traffic hitting `www` subdomain
    const wwwnicksedneyBucket = new s3.Bucket(this, "wwwnicksedneybucket", {
      bucketName: "www.nicksedney.com",
      websiteRedirect: {
        hostName: "nicksedney.com"
      },
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'www.nicksedney.com/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    // Create a new distribution so we can disable cacheing for 'redirect' endpoint. It's not clear
    // to me if previous distribution could be used for both.
    const wwwnicksedneyCloudFront = new cloundfront.Distribution(this, 'wwwnicksedneyCfDistribution', {
      defaultBehavior: {
        origin: new cforigins.S3Origin(wwwnicksedneyBucket),
        viewerProtocolPolicy: cloundfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloundfront.CachePolicy.CACHING_DISABLED
      },
      domainNames: ["www.nicksedney.com"],
      certificate: nickSedneyCert
    });
    new route53.ARecord(this, "wwwnickssedneyalias", {
      recordName: "www.nicksedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(wwwnicksedneyCloudFront)
      ),
      zone: nicksedneyHostedZone
    });

    /// nicholassedney.com
    // New domain means a new hosted zone
    const nicholassedneyHostedZone = route53.HostedZone.fromLookup(this, "nicholassedneyzone", {
      domainName: "nicholassedney.com"
    });
    // We can still use an empty redirect bucket
    const nicholassedneyBucket = new s3.Bucket(this, "nicholassedneybucket", {
      bucketName: "nicholassedney.com",
      websiteRedirect: {
        hostName: "nicksedney.com"
      },
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'nicholassedney.com/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });
    // Route DNS traffic to s3 bucket
    new route53.ARecord(this, "nicholassedneyalias", {
      recordName: "nicholassedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.BucketWebsiteTarget(nicholassedneyBucket)
      ),
      zone: nicholassedneyHostedZone
    });
  }
}
