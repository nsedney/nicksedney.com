import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3deployment from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class NicksedneyComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props, analyticsReporting: false });

    const accessLogsBucket = new s3.Bucket(this, 'nicksedneyAccessLogsBucket', {
      bucketName: "nicksedney.com-access-logs",
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        { expiration: cdk.Duration.days(14) }
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

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

    const deployment = new s3deployment.BucketDeployment(this, "nicksedneyDeployWebsite", {
      sources: [s3deployment.Source.asset("website")],
      destinationBucket: nicksedneyBucket
    });

    // The HostedZone itself must be created by hand - if we try to create in CDK we'll get random name servers that
    // don't match registered domain.  But we can manage the record route traffic to our s3 bucket.
    const nicksedneyHostedZone = route53.HostedZone.fromLookup(this, "nicksedneyzone", {
      domainName: "nicksedney.com"
    });
    new route53.ARecord(this, "nickssedneyalias", {
      recordName: "nicksedney.com",
      target: route53.RecordTarget.fromAlias(
        new targets.BucketWebsiteTarget(nicksedneyBucket)
      ),
      zone: nicksedneyHostedZone,
      comment: "CDK managed"
    });
  }
}
