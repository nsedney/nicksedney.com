import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class NicksedneyComStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props, analyticsReporting: false });

    const nicksedneyBucket = new s3.Bucket(this, "nicksedneybucket", {
      bucketName: "nicksedney.com",
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: false,
        ignorePublicAcls: true,
        restrictPublicBuckets: false
      },
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

  }
}
