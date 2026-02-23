import { Admin } from '../admin/admin.model';
import { Driver } from '../driver/driver.model';
import { Organization } from '../organization/organization.model';
import { User } from '../user/user.model';
import { ROLES } from '../../constants/roles';
import { comparePassword } from '../../utils/comparePassword';
import { generateTokens } from '../../utils/generateTokens';
import { hashPassword } from '../../utils/hashPassword';

interface AdminSignupInput {
	name: string;
	organizationName: string;
	email: string;
	password: string;
}

interface AdminLoginInput {
	email: string;
	password: string;
}

interface MemberLoginInput {
	role: 'user' | 'driver';
	memberId: string;
	password: string;
	organizationSlug?: string;
}

interface CreateMemberInput {
	name: string;
	memberId: string;
	password: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const createBaseSlug = (organizationName: string): string => {
	return organizationName
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'organization';
};

const generateUniqueOrganizationSlug = async (organizationName: string): Promise<string> => {
	const baseSlug = createBaseSlug(organizationName);
	let slugCandidate = baseSlug;
	let counter = 1;

	while (await Organization.exists({ slug: slugCandidate })) {
		counter += 1;
		slugCandidate = `${baseSlug}-${counter}`;
	}

	return slugCandidate;
};

export const authService = {
	signupAdmin: async (input: AdminSignupInput) => {
		const existingAdmin = await Admin.findOne({ email: normalizeEmail(input.email) });

		if (existingAdmin) {
			throw new Error('Admin email already exists');
		}

		const slug = await generateUniqueOrganizationSlug(input.organizationName);
		const organization = await Organization.create({
			name: input.organizationName.trim(),
			slug,
		});

		const passwordHash = await hashPassword(input.password);

		const admin = await Admin.create({
			organizationId: organization._id,
			name: input.name.trim(),
			email: normalizeEmail(input.email),
			passwordHash,
		});

		const { accessToken, refreshToken } = generateTokens({
			sub: String(admin._id),
			organizationId: String(admin.organizationId),
			role: ROLES.ADMIN,
		});

		return {
			accessToken,
			refreshToken,
			admin: {
				id: String(admin._id),
				name: admin.name,
				email: admin.email,
				organization: {
					id: String(organization._id),
					name: organization.name,
					slug: organization.slug,
				},
			},
		};
	},

	loginAdmin: async (input: AdminLoginInput) => {
		const admin = await Admin.findOne({ email: normalizeEmail(input.email) });

		if (!admin) {
			throw new Error('Invalid credentials');
		}

		const passwordValid = await comparePassword(input.password, admin.passwordHash);

		if (!passwordValid) {
			throw new Error('Invalid credentials');
		}

		const organization = await Organization.findById(admin.organizationId);

		if (!organization) {
			throw new Error('Organization not found for admin');
		}

		const { accessToken, refreshToken } = generateTokens({
			sub: String(admin._id),
			organizationId: String(admin.organizationId),
			role: ROLES.ADMIN,
		});

		return {
			accessToken,
			refreshToken,
			admin: {
				id: String(admin._id),
				name: admin.name,
				email: admin.email,
				organization: {
					id: String(organization._id),
					name: organization.name,
					slug: organization.slug,
				},
			},
		};
	},

	loginMember: async (input: MemberLoginInput) => {
		if (input.role === ROLES.USER) {
			if (input.organizationSlug) {
				const organization = await Organization.findOne({ slug: input.organizationSlug });

				if (!organization) {
					throw new Error('Organization not found');
				}

				const user = await User.findOne({
					organizationId: organization._id,
					memberId: input.memberId,
				});

				if (!user || !(await comparePassword(input.password, user.passwordHash))) {
					throw new Error('Invalid credentials');
				}

				const { accessToken, refreshToken } = generateTokens({
					sub: String(user._id),
					organizationId: String(user.organizationId),
					role: ROLES.USER,
				});

				return {
					accessToken,
					refreshToken,
					member: {
						id: String(user._id),
						role: ROLES.USER,
						name: user.name,
						memberId: user.memberId,
					},
				};
			}

			const users = await User.find({ memberId: input.memberId }).limit(2);

			if (users.length === 0) {
				throw new Error('Invalid credentials');
			}

			if (users.length > 1) {
				throw new Error('Multiple accounts found. Please provide organizationSlug');
			}

			const user = users[0];
			const passwordValid = await comparePassword(input.password, user.passwordHash);

			if (!passwordValid) {
				throw new Error('Invalid credentials');
			}

			const { accessToken, refreshToken } = generateTokens({
				sub: String(user._id),
				organizationId: String(user.organizationId),
				role: ROLES.USER,
			});

			return {
				accessToken,
				refreshToken,
				member: {
					id: String(user._id),
					role: ROLES.USER,
					name: user.name,
					memberId: user.memberId,
				},
			};
		}

		if (input.organizationSlug) {
			const organization = await Organization.findOne({ slug: input.organizationSlug });

			if (!organization) {
				throw new Error('Organization not found');
			}

			const driver = await Driver.findOne({
				organizationId: organization._id,
				employeeId: input.memberId,
			});

			if (!driver || !(await comparePassword(input.password, driver.passwordHash))) {
				throw new Error('Invalid credentials');
			}

			const { accessToken, refreshToken } = generateTokens({
				sub: String(driver._id),
				organizationId: String(driver.organizationId),
				role: ROLES.DRIVER,
			});

			return {
				accessToken,
				refreshToken,
				member: {
					id: String(driver._id),
					role: ROLES.DRIVER,
					name: driver.name,
					memberId: driver.employeeId,
				},
			};
		}

		const drivers = await Driver.find({ employeeId: input.memberId }).limit(2);

		if (drivers.length === 0) {
			throw new Error('Invalid credentials');
		}

		if (drivers.length > 1) {
			throw new Error('Multiple accounts found. Please provide organizationSlug');
		}

		const driver = drivers[0];
		const passwordValid = await comparePassword(input.password, driver.passwordHash);

		if (!passwordValid) {
			throw new Error('Invalid credentials');
		}

		const { accessToken, refreshToken } = generateTokens({
			sub: String(driver._id),
			organizationId: String(driver.organizationId),
			role: ROLES.DRIVER,
		});

		return {
			accessToken,
			refreshToken,
			member: {
				id: String(driver._id),
				role: ROLES.DRIVER,
				name: driver.name,
				memberId: driver.employeeId,
			},
		};
	},

	createUserByAdmin: async (organizationId: string, input: CreateMemberInput) => {
		const existingUser = await User.findOne({
			organizationId,
			memberId: input.memberId,
		});

		if (existingUser) {
			throw new Error('User memberId already exists');
		}

		const user = await User.create({
			organizationId,
			name: input.name.trim(),
			memberId: input.memberId.trim(),
			passwordHash: await hashPassword(input.password),
		});

		return {
			id: String(user._id),
			name: user.name,
			memberId: user.memberId,
		};
	},

	createDriverByAdmin: async (organizationId: string, input: CreateMemberInput) => {
		const existingDriver = await Driver.findOne({
			organizationId,
			employeeId: input.memberId,
		});

		if (existingDriver) {
			throw new Error('Driver memberId already exists');
		}

		const driver = await Driver.create({
			organizationId,
			name: input.name.trim(),
			employeeId: input.memberId.trim(),
			passwordHash: await hashPassword(input.password),
		});

		return {
			id: String(driver._id),
			name: driver.name,
			memberId: driver.employeeId,
		};
	},
};

