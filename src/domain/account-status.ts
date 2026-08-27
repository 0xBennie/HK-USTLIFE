export type AccountConnectorId = 'outlook' | 'canvas' | 'sis';
export type ConnectorState =
  | 'awaiting_consent'
  | 'development_token_configured'
  | 'institutional_approval_required';

export interface TokenEnvironment {
  HKUST_GRAPH_ACCESS_TOKEN?: string;
  HKUST_MCP_API_KEY?: string;
}

export interface AccountStatus {
  id: AccountConnectorId;
  mode: 'read_only';
  state: ConnectorState;
  requiredScopes: string[];
  nextStep: string;
}

export function getAccountStatus(environment: TokenEnvironment): AccountStatus[] {
  return [
    {
      id: 'outlook',
      mode: 'read_only',
      state: environment.HKUST_GRAPH_ACCESS_TOKEN
        ? 'development_token_configured'
        : 'awaiting_consent',
      requiredScopes: ['Mail.ReadBasic', 'Calendars.ReadBasic'],
      nextStep: environment.HKUST_GRAPH_ACCESS_TOKEN
        ? 'A development token is configured. Use an approved secret store and delegated HKUST consent before production use.'
        : 'Register an HKUST Entra application and obtain delegated consent; never provide a password or MFA code to this server.',
    },
    {
      id: 'canvas',
      mode: 'read_only',
      state: 'institutional_approval_required',
      requiredScopes: ['course read', 'calendar read', 'assignment read'],
      nextStep: 'HKUST Canvas root-account Developer Key and read-only scopes are required before this connector can be enabled.',
    },
    {
      id: 'sis',
      mode: 'read_only',
      state: 'institutional_approval_required',
      requiredScopes: ['enrolment read', 'class schedule read'],
      nextStep: 'ARO and ITSO must provide an approved protected API; the server does not automate SIS sign-in.',
    },
  ];
}
