CREATE TABLE "game_rooms" (
	"id" text PRIMARY KEY,
	"lobby" jsonb NOT NULL,
	"engine" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_scores" (
	"id" text PRIMARY KEY,
	"username" text NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"total_cash_earned" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
