# Root Cause Analysis: Cannot Clear Optional Fields When Editing

## Bug Summary

Users cannot clear optional fields (description, department, email) when editing clients or work entries. After clearing a field and saving, the old value persists silently -- the user receives no error, but the field is never actually updated.

## Steps to Reproduce

1. Create a client with all fields filled in (name, department, email, description)
2. Click the edit button for that client
3. Clear the description field (select all text, delete)
4. Click "Update"
5. **Expected:** Description is cleared (shows "No description" chip)
6. **Actual:** Description retains its old value -- the update is silently ignored

The same bug affects:
- Client editing: description, department, and email fields
- Work entry editing: description field

## Root Cause

The bug originates in the frontend form submission logic. When building the update payload, empty strings are converted to `undefined` using the JavaScript `||` operator:

```typescript
// ClientsPage.tsx (line 134, before fix)
updateMutation.mutate({
  id: editingClient.id,
  data: {
    name: formData.name,
    description: formData.description || undefined,  // BUG: '' becomes undefined
    department: formData.department || undefined,     // BUG: '' becomes undefined
    email: formData.email || undefined,               // BUG: '' becomes undefined
  },
});
```

```typescript
// WorkEntriesPage.tsx (line 159, before fix)
const entryData = {
  clientId: formData.clientId,
  hours,
  description: formData.description || undefined,    // BUG: '' becomes undefined
  date: formData.date.toISOString().split('T')[0],
};
```

When a field value is `undefined`, `JSON.stringify()` omits the key entirely from the request body. The backend's dynamic update query builder then skips any field not present in the request:

```javascript
// backend/src/routes/clients.js (line 139)
if (value.description !== undefined) {   // field was omitted, so this is skipped
  updates.push('description = ?');
  values.push(value.description || null);
}
```

This creates a chain of failure:
1. User clears field -> form state is `""` (empty string)
2. `"" || undefined` evaluates to `undefined` (falsy short-circuit)
3. `JSON.stringify({description: undefined})` omits the key
4. Backend receives no `description` field in the request body
5. Backend skips the field in the UPDATE query
6. Database retains the old value

## Why It Happened

The `|| undefined` pattern was likely added with good intentions -- to avoid sending empty strings for optional fields during **creation**. For new records, omitting an empty optional field is fine because the backend defaults them to `null`. However, the same pattern was applied to the **update** path, where omitting a field means "don't change this field" rather than "set this field to empty."

This is a common JavaScript pitfall where the `||` operator treats empty strings as falsy, making it impossible to distinguish between "user didn't touch this field" and "user intentionally cleared this field."

## Fix Applied

The fix removes the `|| undefined` coercion from the **update** code paths so that empty strings are sent to the backend as-is:

**`frontend/src/pages/ClientsPage.tsx`** -- Update mutation payload:
```typescript
data: {
  name: formData.name,
  description: formData.description,    // empty string is now sent
  department: formData.department,      // empty string is now sent
  email: formData.email,                // empty string is now sent
},
```

**`frontend/src/pages/WorkEntriesPage.tsx`** -- Entry data payload:
```typescript
const entryData = {
  clientId: formData.clientId,
  hours,
  description: formData.description,    // empty string is now sent
  date: formData.date.toISOString().split('T')[0],
};
```

No backend changes were needed because:
- The Joi validation schemas already accept empty strings (`.allow('')`)
- The backend route handlers already convert empty strings to `null` for database storage (`value.description || null`)

## Impact

- **Severity:** High -- core CRUD functionality broken for all users
- **Scope:** Affects all optional fields across client and work entry editing
- **User experience:** Silent failure with no error message, making it appear as if the app is ignoring user input
- **Data integrity:** Users cannot correct or remove previously entered optional information

## Verification

After the fix, clearing an optional field and saving will:
1. Send the empty string in the API request body
2. Backend validates and converts `""` to `null`
3. Database UPDATE sets the column to `NULL`
4. UI refreshes showing the field as cleared
