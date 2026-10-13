
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import {
  requireAuth,
  requireOrganizer,
  requireStaff,
} from '../src/middleware/auth.js';

process.env.JWT_SECRET = 'test-secret-for-auth-tests';

const createResponse = () => ({
  statusCode: 200,
  body: null,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(body) {
    this.body = body;
    return this;
  },
});

const createToken = (role) =>
  jwt.sign(
    { id: '507f1f77bcf86cd799439011', role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

test('requireAuth rejects a request without a token', () => {
  const req = { headers: {} };
  const res = createResponse();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('requireAuth rejects an invalid token', () => {
  const req = {
    headers: { authorization: 'Bearer invalid-token' },
  };
  const res = createResponse();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('requireAuth accepts a valid token and sets req.user', () => {
  const req = {
    headers: { authorization: `Bearer ${createToken('staff')}` },
  };
  const res = createResponse();
  let nextCalled = false;

  requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'staff');
  assert.equal(req.user.id, '507f1f77bcf86cd799439011');
});

test('requireStaff allows staff and rejects organizers', () => {
  const res = createResponse();
  let nextCalled = false;

  requireStaff(
    { user: { role: 'staff' } },
    res,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);

  const deniedRes = createResponse();
  let deniedNextCalled = false;

  requireStaff(
    { user: { role: 'organizer' } },
    deniedRes,
    () => {
      deniedNextCalled = true;
    }
  );

  assert.equal(deniedRes.statusCode, 403);
  assert.equal(deniedNextCalled, false);
});

test('requireOrganizer allows organizers and rejects staff', () => {
  const res = createResponse();
  let nextCalled = false;

  requireOrganizer(
    { user: { role: 'organizer' } },
    res,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);

  const deniedRes = createResponse();
  let deniedNextCalled = false;

  requireOrganizer(
    { user: { role: 'staff' } },
    deniedRes,
    () => {
      deniedNextCalled = true;
    }
  );

  assert.equal(deniedRes.statusCode, 403);
  assert.equal(deniedNextCalled, false);
});
