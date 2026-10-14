const { validateIdParam, buildUpdateSet } = require('../../utils/routeHelpers');

const buildRequest = (params) => ({ params });

describe('routeHelpers', () => {
  describe('validateIdParam', () => {
    let res;
    let next;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      next = jest.fn();
    });

    test('should parse a numeric param to an integer and call next', () => {
      const req = buildRequest({ id: '42' });

      validateIdParam('id', 'client')(req, res, next);

      expect(req.params).toEqual({ id: 42 });
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should use the configured param name', () => {
      const req = buildRequest({ clientId: '7' });

      validateIdParam('clientId', 'client')(req, res, next);

      expect(req.params).toEqual({ clientId: 7 });
      expect(next).toHaveBeenCalled();
    });

    test('should respond 400 with labelled error for a non-numeric param', () => {
      const req = buildRequest({ id: 'abc' });

      validateIdParam('id', 'work entry')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid work entry ID' });
      expect(next).not.toHaveBeenCalled();
    });

    test('should respond 400 when the param is missing', () => {
      const req = buildRequest({});

      validateIdParam('id', 'client')(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid client ID' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('buildUpdateSet', () => {
    const fields = [
      { key: 'name', column: 'name' },
      { key: 'clientId', column: 'client_id' },
      { key: 'description', column: 'description', nullable: true }
    ];

    test('should include only fields present in the data', () => {
      const { setClause, values } = buildUpdateSet({ name: 'Acme' }, fields);

      expect(setClause).toBe('name = ?, updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual(['Acme']);
    });

    test('should map request keys to column names in field order', () => {
      const { setClause, values } = buildUpdateSet(
        { description: 'Desc', clientId: 3, name: 'Acme' },
        fields
      );

      expect(setClause).toBe(
        'name = ?, client_id = ?, description = ?, updated_at = CURRENT_TIMESTAMP'
      );
      expect(values).toEqual(['Acme', 3, 'Desc']);
    });

    test('should store NULL for empty nullable fields', () => {
      const { values } = buildUpdateSet({ description: '' }, fields);

      expect(values).toEqual([null]);
    });

    test('should preserve falsy values for non-nullable fields', () => {
      const { setClause, values } = buildUpdateSet({ clientId: 0 }, fields);

      expect(setClause).toBe('client_id = ?, updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual([0]);
    });

    test('should only touch updated_at when no fields are provided', () => {
      const { setClause, values } = buildUpdateSet({}, fields);

      expect(setClause).toBe('updated_at = CURRENT_TIMESTAMP');
      expect(values).toEqual([]);
    });
  });
});
