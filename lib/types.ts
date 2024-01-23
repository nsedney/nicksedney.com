/**
 * Describes a domain name, and all subdomains that should redirect to the parent
 */
export interface DomainConfig {
    /** Domain name registered with Route53  */
    registeredDomain: string,

    /**
     * Subdomains we want to support.
     * Provide full domain (`SUB.registereddomain.com`.) `registereddomain.com` MUST match provided domain registered in Route53.
     * Wildcard * is support (`*.registereddomain.com`).
     * */
    supportedSubdomains?: string[]
}