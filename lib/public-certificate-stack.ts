import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { DomainConfig } from './types';

/**
 * Stack properties
 * 
 * @remarks In most `env.region` should be set to "us-east-1".
 */
export interface PublicCertificatStackProps extends cdk.StackProps {
    certificateDomain: DomainConfig;
    additionalDomains?: DomainConfig[];
    certificateDescription?: string;
    certificateResourceId?: string;
}

/**
 * Stack solely for creating certificates for domains registered with Route53
 * 
 * @remarks
 * For certain resources to work (at least CloudFront), we must create our certs in region `us-east-1`.
 * If we're operating in a different region, a separate stack is needed to deploy certificate where needed:
 * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#cross-region-certificates 
 *  
 * @remarks
 * All domain names specified here must have a HostedZone allready created in Route53; otherwise deployment will hang
 * until a zone with appropriate CNAME record is added manually:
 * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#dns-validation
 * This should be done automatically when registering a domain name.
*/
export class PublicCertificateStack extends cdk.Stack {
    public readonly nickSedneyCert: acm.Certificate;

    constructor(scope: Construct, id: string, props: PublicCertificatStackProps) {
        super(scope, id, { ...props })

        const redirectDomains = props.additionalDomains ?? []
        const registeredDomains = [props.certificateDomain.registeredDomain, ...redirectDomains.map(domain => domain.registeredDomain)]
        // All additional domain names that we want to include with certificate.
        const alternateDomainsNames = [
            ...(props.certificateDomain.supportedSubdomains ?? []),
            ...redirectDomains.reduce<string[]>(
                (accumulator, domain) => accumulator.concat([domain.registeredDomain, ...(domain.supportedSubdomains ?? [])]),
                []
            )
        ]

        // Look up HostedZone for each registered domain, and put into the object format expected by Certificate resource:
        const hostedZones = registeredDomains.reduce<{ [domainName: string]: cdk.aws_route53.IHostedZone; }>(
            (zones, domainName) => {
                zones[domainName] = route53.HostedZone.fromLookup(this, domainName, { domainName: domainName })
                return zones
            }, {}
        )

        this.nickSedneyCert = new acm.Certificate(this,
            props.certificateResourceId ?? `${props.certificateResourceId ?? props.certificateDomain.registeredDomain + "Certificate"}`, {
            domainName: props.certificateDomain.registeredDomain,
            subjectAlternativeNames: alternateDomainsNames,
            certificateName: props.description,
            validation: acm.CertificateValidation.fromDnsMultiZone(hostedZones)
        })
    }
}

