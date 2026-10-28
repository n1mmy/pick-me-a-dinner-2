CREATE TABLE "prepared_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prepared_for" date NOT NULL,
	"brief" text,
	"ranking" jsonb,
	"input_hash" text,
	"model" text,
	"prepared_at" timestamp with time zone,
	"claimed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prepared_notes_prepared_for_unique" UNIQUE("prepared_for")
);
