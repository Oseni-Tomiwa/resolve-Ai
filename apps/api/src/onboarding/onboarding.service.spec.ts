import { ConflictException } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';

const input = { organizationName: ' Mavery Innovative Systems ', organizationSlug: 'Mavery Innovative Systems!', workspaceName: 'Customer Support', workspaceSlug: 'Customer Support', industry: 'SAAS' as const, teamSize: 'TWO_TO_TEN' as const };

describe('OnboardingService', () => {
  function createTransactionDatabase() {
    const organization = { id: 'org-1', name: 'Mavery Innovative Systems', slug: 'mavery-innovative-systems', industry: 'SAAS', teamSize: 'TWO_TO_TEN', createdAt: new Date(), updatedAt: new Date() };
    const workspace = { id: 'workspace-1', organizationId: 'org-1', name: 'Customer Support', slug: 'customer-support', createdAt: new Date(), updatedAt: new Date() };
    const tx = {
      organizationMember: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ role: 'OWNER' }) },
      organization: { create: jest.fn().mockResolvedValue(organization) },
      workspace: { create: jest.fn().mockResolvedValue(workspace) },
      workspaceMember: { create: jest.fn().mockResolvedValue({ role: 'ADMIN' }) },
      onboardingProgress: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const db = { $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)), organizationMember: { findMany: jest.fn() } };
    return { db, tx, organization, workspace };
  }

  it('reports onboarding as required for a user with no organizations', async () => {
    // Arrange
    const db = { organizationMember: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new OnboardingService(db as never);

    // Act
    const result = await service.status('new-user');

    // Assert
    expect(result).toMatchObject({ required: true, organizations: [], currentOrganization: null, currentWorkspace: null });
    expect(db.organizationMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'new-user' } }));
  });

  it('creates the organization and workspace atomically with owner and admin memberships', async () => {
    // Arrange
    const { db, tx, organization, workspace } = createTransactionDatabase();
    const service = new OnboardingService(db as never);

    // Act
    const result = await service.create('user-1', input);

    // Assert
    expect(tx.organization.create).toHaveBeenCalledWith({ data: expect.objectContaining({ name: 'Mavery Innovative Systems', slug: 'mavery-innovative-systems', industry: 'SAAS', teamSize: 'TWO_TO_TEN' }) });
    expect(tx.organizationMember.create).toHaveBeenCalledWith({ data: { userId: 'user-1', organizationId: 'org-1', role: 'OWNER' } });
    expect(tx.workspace.create).toHaveBeenCalledWith({ data: { organizationId: 'org-1', name: 'Customer Support', slug: 'customer-support' } });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({ data: { workspaceId: 'workspace-1', userId: 'user-1', role: 'ADMIN' } });
    expect(result).toEqual({ organization, workspace });
  });

  it('reuses the existing owner workspace when onboarding is retried', async () => {
    // Arrange
    const { db, tx } = createTransactionDatabase();
    tx.organizationMember.findFirst.mockResolvedValue({ organizationId: 'org-1', organization: { id: 'org-1', workspaces: [{ id: 'workspace-1' }] } });
    const service = new OnboardingService(db as never);

    // Act
    const action = service.create('user-1', input);

    // Assert
    await expect(action).resolves.toEqual({ organization: { id: 'org-1', workspaces: [{ id: 'workspace-1' }] }, workspace: { id: 'workspace-1' } });
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it('translates a duplicate organization slug into a readable conflict', async () => {
    // Arrange
    const { db, tx } = createTransactionDatabase();
    tx.organization.create.mockRejectedValue({ code: 'P2002' });
    const service = new OnboardingService(db as never);

    // Act
    const action = service.create('user-1', input);

    // Assert
    await expect(action).rejects.toThrow(new ConflictException('That organization or workspace slug is already in use'));
  });

  it('does not complete when workspace creation fails inside the transaction', async () => {
    // Arrange
    const { db, tx } = createTransactionDatabase();
    const failure = new Error('workspace unavailable');
    tx.workspace.create.mockRejectedValue(failure);
    db.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => { await callback(tx); throw failure; });
    const service = new OnboardingService(db as never);

    // Act
    const action = service.create('user-1', input);

    // Assert
    await expect(action).rejects.toThrow(failure);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.workspaceMember.create).not.toHaveBeenCalled();
  });

  it('returns only organizations and workspaces belonging to the requesting user', async () => {
    // Arrange
    const organization = { id: 'org-1', name: 'Owned', slug: 'owned', workspaces: [{ id: 'workspace-1', name: 'Support', slug: 'support' }] };
    const db = { organizationMember: { findMany: jest.fn().mockResolvedValue([{ organization }]) } };
    const service = new OnboardingService(db as never);

    // Act
    const result = await service.status('user-1');

    // Assert
    expect(result.currentOrganization).toEqual(organization);
    expect(result.organizations).toEqual([organization]);
    expect(db.organizationMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
  });
});
