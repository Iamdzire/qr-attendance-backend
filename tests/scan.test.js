import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import Event from '../src/models/event.js';
import Ticket from '../src/models/ticket.js';
import Scan from '../src/models/scan.js';
import { validateTicket } from '../src/controllers/scan.js';

process.env.JWT_SECRET = 'test-secret-for-scan-tests';

const eventId = '507f1f77bcf86cd799439012';
const staffId = '507f1f77bcf86cd799439011';
const ticketId = '507f1f77bcf86cd799439013';
const attendeeId = '507f1f77bcf86cd799439014';

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

const createRequest = (qrToken, requestedEventId = eventId) => ({
    body: {
        qr_token: qrToken,
        event_id: requestedEventId,
    },
    user: { id: staffId, role: 'staff' },
});

const createQrToken = (overrides = {}) =>
    jwt.sign(
        {
            ticketId,
            eventId,
            attendeeId,
            jti: 'scan-test-token-id',
            ...overrides,
        },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
    );

const mockEventFound = () => {
    mock.method(Event, 'findById', () => ({
        select: () => ({
            lean: async () => ({ _id: eventId }),
        }),
    }));
};

const mockTicketFound = () => {
    mock.method(Ticket, 'findOne', async () => ({
        _id: ticketId,
        event_id: eventId,
        attendee_id: attendeeId,
        code_string: 'TEST-TICKET-001',
        status: 'unused',
    }));
};

const mockScanCreate = () => {
    mock.method(Scan, 'create', async (scan) => ({
        ...scan,
        createdAt: new Date(),
    }));
};

test('rejects an invalid QR signature before looking up a ticket', async (t) => {
    t.after(() => t.mock.restoreAll());

    const invalidToken = jwt.sign(
        { ticketId, eventId, attendeeId },
        'a-different-secret',
        { algorithm: 'HS256', expiresIn: '1h' }
    );

    const ticketLookup = mock.method(Ticket, 'findOne', async () => null);
    const res = createResponse();

    await validateTicket(createRequest(invalidToken), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'invalid');
    assert.equal(ticketLookup.mock.callCount(), 0);
});

test('rejects an expired QR token', async (t) => {
    t.after(() => t.mock.restoreAll());

    const expiredToken = jwt.sign(
        { ticketId, eventId, attendeeId },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: -1 }
    );

    const ticketLookup = mock.method(Ticket, 'findOne', async () => null);
    const res = createResponse();

    await validateTicket(createRequest(expiredToken), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'invalid');
    assert.equal(ticketLookup.mock.callCount(), 0);
});

test('rejects a token with a mismatched attendee claim', async (t) => {
    t.after(() => t.mock.restoreAll());

    mockEventFound();
    mockTicketFound();
    mockScanCreate();

    const token = createQrToken({
        attendeeId: '507f1f77bcf86cd799439099',
    });

    const res = createResponse();

    await validateTicket(createRequest(token), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'invalid');
});

test('rejects a token with a mismatched ticket claim', async (t) => {
    t.after(() => t.mock.restoreAll());

    mockEventFound();
    mockTicketFound();
    mockScanCreate();

    const token = createQrToken({
        ticketId: '507f1f77bcf86cd799439099',
    });

    const res = createResponse();

    await validateTicket(createRequest(token), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'invalid');
});

test('rejects a valid ticket presented for a different event', async (t) => {
    t.after(() => t.mock.restoreAll());

    const otherEventId = '507f1f77bcf86cd799439015';

    mock.method(Event, 'findById', () => ({
        select: () => ({
            lean: async () => ({ _id: otherEventId }),
        }),
    }));

    mockTicketFound();
    mockScanCreate();

    const token = createQrToken();
    const res = createResponse();

    await validateTicket(createRequest(token, otherEventId), res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, 'wrong-event');
});
