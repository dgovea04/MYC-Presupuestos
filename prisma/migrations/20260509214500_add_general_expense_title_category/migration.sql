ALTER TABLE "GeneralExpenseTitle"
ADD COLUMN "category" "GeneralExpenseItemCategory" NOT NULL DEFAULT 'STANDARD';

UPDATE "GeneralExpenseTitle" AS title
SET "category" = item."category"
FROM (
    SELECT DISTINCT ON ("titleId")
        "titleId",
        "category"
    FROM "GeneralExpenseItem"
    ORDER BY "titleId", "sortOrder" ASC, "createdAt" ASC
) AS item
WHERE item."titleId" = title."id";
