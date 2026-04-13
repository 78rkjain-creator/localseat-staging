-- CreateTable
CREATE TABLE "canvass_list_entries" (
    "id" TEXT NOT NULL,
    "canvassListId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvass_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "canvass_list_entries_canvassListId_personId_key" ON "canvass_list_entries"("canvassListId", "personId");

-- AddForeignKey
ALTER TABLE "canvass_list_entries" ADD CONSTRAINT "canvass_list_entries_canvassListId_fkey" FOREIGN KEY ("canvassListId") REFERENCES "canvass_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvass_list_entries" ADD CONSTRAINT "canvass_list_entries_personId_fkey" FOREIGN KEY ("personId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvass_list_entries" ADD CONSTRAINT "canvass_list_entries_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
