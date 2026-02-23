import { Role } from '../../constants/roles';

export interface AuthTokenPayload {
    sub: string;
    organizationId: string;
    role: Role;
}

export interface AuthenticatedRequestUser extends AuthTokenPayload {
    iat?: number;
    exp?: number;
}
