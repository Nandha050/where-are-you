import { User } from './user.model';
import { hashPassword } from '../../utils/hashPassword';

const formatUser = (user: InstanceType<typeof User>) => ({
    id: String(user._id),
    name: user.name,
    memberId: user.memberId,
    organizationId: String(user.organizationId),
    createdAt: user.createdAt,
});

export const userService = {
    getUsers: async (organizationId: string) => {
        const users = await User.find({ organizationId }).sort({ createdAt: -1 });
        return users.map(formatUser);
    },

    getUserById: async (organizationId: string, userId: string) => {
        const user = await User.findOne({ _id: userId, organizationId });
        if (!user) throw new Error('User not found');
        return formatUser(user);
    },

    updateUser: async (
        organizationId: string,
        userId: string,
        input: { name?: string; memberId?: string; password?: string }
    ) => {
        const user = await User.findOne({ _id: userId, organizationId });
        if (!user) throw new Error('User not found');

        if (input.memberId && input.memberId !== user.memberId) {
            const duplicate = await User.findOne({
                organizationId,
                memberId: input.memberId,
                _id: { $ne: userId },
            });
            if (duplicate) throw new Error('memberId already in use');
        }

        const updates: Record<string, unknown> = {};
        if (input.name) updates.name = input.name.trim();
        if (input.memberId) updates.memberId = input.memberId.trim();
        if (input.password) updates.passwordHash = await hashPassword(input.password);

        const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });
        return formatUser(updated!);
    },

    deleteUser: async (organizationId: string, userId: string) => {
        const user = await User.findOneAndDelete({ _id: userId, organizationId });
        if (!user) throw new Error('User not found');
        return { message: 'User deleted successfully' };
    },
};
