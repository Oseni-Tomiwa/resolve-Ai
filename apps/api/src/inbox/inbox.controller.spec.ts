import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { InboxController } from './inbox.controller';

describe('InboxController', () => {
  it('exposes the canonical workspace inbox GET route', async () => {
    // Arrange
    const service = { list: jest.fn().mockResolvedValue({ items: [], unreadCount: 0, canManage: false }) };
    const controller = new InboxController(service as never);
    const listDescriptor = Object.getOwnPropertyDescriptor(InboxController.prototype, 'list');

    // Act
    const result = await controller.list({ user: { sub: 'member-1' } } as never, 'workspace-1', {});

    // Assert
    expect(Reflect.getMetadata('path', InboxController)).toBe('workspaces/:workspaceId/inbox');
    expect(Reflect.getMetadata('method', listDescriptor?.value)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata('path', listDescriptor?.value)).toBe('/');
    expect(result.data).toEqual({ items: [], unreadCount: 0, canManage: false });
    expect(service.list).toHaveBeenCalledWith('member-1', 'workspace-1', {});
  });
});
