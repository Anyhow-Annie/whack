# Living Organizational Memory

An internal knowledge app. Employees sign in, browse projects on a mind map, upload source documents, and leave continuity notes for the next person on a project.

This increment connects the React app to Firebase, enforces roles, and stores the organizational records. Semantic search is a Cloud Function that checks the caller's role and reports that embeddings are not configured. No AI provider is called, and no AI key is read by the frontend.

## Assumptions

- One Firebase project is one organization.
- A person's access role is the `role` custom claim. Cloud Functions are the only writers of that claim.
- The employee directory can say `viewer` when someone creates a profile. That field does not grant access.
- Gemini and OpenAI are not wired in. Choose one before the next increment.

## Run the UI

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` from Firebase console → Project settings → Your apps. Restart the dev server after changing it.

## Deploy rules and functions

```bash
npm install --prefix functions
npm run build --prefix functions
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only firestore:rules,storage,functions
```

The first signed-in person can use **Claim initial admin**. After that, an admin grants roles with **Grant a role**. The employee must choose **Refresh access** before the new role applies.

## Local emulators

Use placeholder web config in `.env.local`, set `VITE_USE_FIREBASE_EMULATORS=true`, then:

```bash
npm run build --prefix functions
npx firebase-tools emulators:start
```

## Collections

| Collection | Who can write |
| --- | --- |
| `employees/{uid}` | The person can create a viewer profile and edit name, title, and department. Role changes go through Cloud Functions. |
| `projects/{id}` | Managers and admins. |
| `documents/{id}` | Project members create a pending record, then mark it uploaded. Processing status is written by a function. |
| `knowledgeChunks/{id}` | Cloud Functions only. `embedding` stays null until a provider is added. |
| `projectUpdates/{id}` | Project members. |
| `knowledgeRelationships/{id}` | Managers and admins. |
| `meta/bootstrap` | Cloud Functions only. Records the first admin. |

## Layout

- `src/lib/firebase.ts` initializes the web SDK from environment variables.
- `src/auth` holds the session and the role checks the UI uses. Firestore rules repeat those checks.
- `src/services` reads and writes Firestore and Storage. It does not call an AI API.
- `src/mindmap` turns projects, documents, and relationships into a React Flow graph.
- `functions/src/ai/embeddings.ts` is the only place a future provider key should be read.
- `functions/src/authz.ts` rejects callable requests that do not have an allowed role claim.
- `firestore.rules` and `storage.rules` are the access boundary for direct client reads and writes.
