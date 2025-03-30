To add a new data migration:

1. Add a new migration object in the array of migrations
2. Name it with the next ascending number like this: 05_my-fith-migration.ts

After some time, i think we should comment out or remove the contents of the
migrations that are ran. As the codebase changes, the content of the migration
files CAN NOT BE MODIFIED, so could just be commented out when prod has ran the
migrations.

Why inline migrations list instead of separate migration files?

- because deno deploy does not support import of local files

**IMPORTANT** The edge servers can easily run out of memory and crach mid
migration. This will cause the next restart to retry the migration. If your
migration script is not idempotent it can cause issues.
