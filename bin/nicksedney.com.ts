#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StaticWebsiteStack } from '../lib/static-website-stack';
import { PublicCertificateStack } from '../lib/public-certificate-stack';
import type { DomainConfig } from '../lib/types';

// Location of static site to be deployed, relative to project root
const staticSiteLocation = "website/astro/dist";

/** 
 * Define all domains we'd like to use for our site.  Note each `registeredDomain` must be registered in Route53,
 * along with a corresponding `HostedZone` that should have been created on registration.
 */
const stackConfig = {
  domain: { registeredDomain: "nicksedney.com", supportedSubdomains: ["*.nicksedney.com"] } as DomainConfig,
  redirectDomains: [
    { registeredDomain: "nicholassedney.com", supportedSubdomains: ["*.nicholassedney.com"] },
    { registeredDomain: "nsedney.com", supportedSubdomains: ["*.nsedney.com"] },
    { registeredDomain: "nickess.com", supportedSubdomains: ["*.nickess.com"] },
  ] as DomainConfig[]
};

const app = new cdk.App();

// We need to create our HTTPS cert in a separate stack as it needs to exist in `us-east-1` region:
// https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#cross-region-certificates 
const httpsCertStack = new PublicCertificateStack(app, 'NicksedneyHttpsCert', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, // We appear to need to explicitly provide `account` for multi-stack deployment
    region: "us-east-1", // TODO: Are there defined types we could/should use?  What's ts convention for constants?
  },
  crossRegionReferences: true,
  // customParams
  certificateDomain: stackConfig.domain,
  additionalDomains: stackConfig.redirectDomains,
  certificateDescription: 'Nick Sedney Homepage',
  certificateResourceId: 'nicksedneyCertificate'
});

new StaticWebsiteStack(app, 'NicksedneyComStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  crossRegionReferences: true,
  // customParams
  primaryDomain: stackConfig.domain,
  redirectDomains: stackConfig.redirectDomains,
  websiteCert: httpsCertStack.cert,
  websitePath: staticSiteLocation,
  isBridgyHandle: true
}).addDependency(httpsCertStack);
