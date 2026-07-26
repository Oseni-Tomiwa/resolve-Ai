import { NotFoundException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

type OrganizationDatabase = {
  $transaction: jest.Mock;
};

describe('OrganizationsService', () => {
  it('creates an owner organization with a default General workspace', async () => {
    // Arrange
    const organization = { id: 'org-1', name: 'Acme', slug: 'acme', createdAt: new Date(), updatedAt: new Date() };
    const workspace = { id: 'workspace-1', organizationId: 'org-1', name: 'General', slug: 'general', createdAt: new Date(), updatedAt: new Date() };
    const tx = {
      organization: { create: jest.fn().mockResolvedValue(organization) },
      organizationMember: { create: jest.fn().mockResolvedValue({}) },
      workspace: { create: jest.fn().mockResolvedValue(workspace) },
      workspaceMember: { create: jest.fn().mockResolvedValue({}) },
    };
    const db: OrganizationDatabase = { $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new OrganizationsService(db as never);

    // Act
    const result = await service.create('user-1', { name: ' Acme ', slug: 'acme' });

    // Assert
    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: 'Acme', slug: 'acme' } });
    expect(tx.organizationMember.create).toHaveBeenCalledWith({ data: { userId: 'user-1', organizationId: 'org-1', role: 'OWNER' } });
    expect(tx.workspace.create).toHaveBeenCalledWith({ data: { organizationId: 'org-1', name: 'General', slug: 'general' } });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({ data: { workspaceId: 'workspace-1', userId: 'user-1', role: 'ADMIN' } });
    expect(result.workspaces).toEqual([workspace]);
  });

  it('does not expose an organization to a user outside its tenant', async () => {
    // Arrange
    const db = { organization: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OrganizationsService(db as never);

    // Act
    const action = service.get('outside-user', 'org-1');

    // Assert
    await expect(action).rejects.toThrow(new NotFoundException('Organization not found'));
    expect(db.organization.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org-1', members: { some: { userId: 'outside-user' } } } }));
  });
});
