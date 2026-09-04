CREATE TABLE "game_transcripts" (
	"round_id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"game_code" text NOT NULL,
	"revision" integer NOT NULL,
	"integrity" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"transcript" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "game_transcripts_game_id_idx" ON "game_transcripts" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_transcripts_started_at_idx" ON "game_transcripts" USING btree ("started_at");