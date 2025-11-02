declare module 'libopaque' {
  interface CredentialRequest {
    pub: Uint8Array;
    sec: Uint8Array;
  }

  interface CredentialResponse {
    pub: Uint8Array;
    resp: Uint8Array;
  }

  interface FinalizationRecord {
    rec: Uint8Array;
    export_key: Uint8Array;
  }

  interface RegisteredUserRecord {
    rec: Uint8Array;
  }

  interface RegistrationRequest {
    pub: Uint8Array;
    sec: Uint8Array;
  }

  interface RegistrationResponse {
    pub: Uint8Array;
  }

  interface FinalizedRegistration {
    rec: Uint8Array;
    export_key: Uint8Array;
  }

  interface AuthenticationRecord {
    authU: Uint8Array;
    export_key: Uint8Array;
  }

  interface Config {
    skU: any;
    pkU: any;
    pkS: any;
    idS: any;
    idU: any;
  }

  interface Ids {
    idS: string;
    idU: string;
  }

  interface LibopaqueModule {
    ready?: Promise<void>;
    NotPackaged: any;
    InSecEnv: any;
    InClearEnv: any;
    
    createCredentialRequest(options: { pwdU: string }): CredentialRequest;
    recoverCredentials(options: {
      pwdU: string;
      pub: Uint8Array;
      resp: Uint8Array;
      sec: Uint8Array;
      cfg: Config;
      ids: Ids;
    }): AuthenticationRecord;
    
    createRegistrationRequest(options: { pwdU: string }): RegistrationRequest;
    createRegistrationResponse(options: {
      pwd: Uint8Array;
      pub: Uint8Array;
    }): RegistrationResponse;
    
    finalizeRequest(options: {
      sec: Uint8Array;
      pub: Uint8Array;
      cfg: Config;
      ids: Ids;
    }): FinalizedRegistration;
  }

  const libopaque: LibopaqueModule;
  export default libopaque;
}
