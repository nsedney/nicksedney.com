#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NicksedneyComStack } from '../lib/nicksedney.com-stack';
import { NicksedneyCertStack } from '../lib/nicksedneycertstack';
import { RegionInfo } from 'aws-cdk-lib/region-info';

const app = new cdk.App();

// We need to create our HTTPS cert in a separate stack as it needs to exist in `us-east-1` region
const certStack = new NicksedneyCertStack(app, 'NicksedneyCertStack', {
  env: {
    region: "us-east-1", // TODO: Are there defined types we could/should use?  Whats ts convention for constants?
  },
  crossRegionReferences: true,
});

new NicksedneyComStack(app, 'NicksedneyComStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});