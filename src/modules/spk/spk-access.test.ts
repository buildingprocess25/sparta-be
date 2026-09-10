import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSpkRole } from './spk-access';
import type { AuthenticatedUser } from '../auth/auth-session.service';
const user = (role: string) => ({ roles: [role], cabang: 'CILACAP' } as AuthenticatedUser);
test('existing Super Human and manager aliases retain SPK access', () => {
    for (const role of ['SUPER HUMAN','BUILDING & MAINTENANCE SUPER HUMAN']) {
        for (const action of ['submit','approval','intervention'] as const) assert.doesNotThrow(() => assertSpkRole(user(role),action));
    }
    for (const role of ['BRANCH MANAGER','MANAGER']) assert.doesNotThrow(() => assertSpkRole(user(role),'approval'));
});
test('contractor and unauthenticated actor cannot approve or submit SPK', () => {
    assert.throws(() => assertSpkRole(undefined,'approval'));
    assert.throws(() => assertSpkRole(user('KONTRAKTOR'),'approval'));
    assert.throws(() => assertSpkRole(user('KONTRAKTOR'),'submit'));
    assert.throws(() => assertSpkRole(user('BRANCH MANAGER'),'intervention'));
});
