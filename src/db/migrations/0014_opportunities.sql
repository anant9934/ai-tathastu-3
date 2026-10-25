CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"type" text NOT NULL,
	"location" text,
	"deadline" text,
	"required_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_type_idx" ON "opportunities" USING btree ("type");
--> statement-breakpoint
INSERT INTO "opportunities" ("title", "organization", "type", "location", "deadline", "required_skills", "description", "url") VALUES
('Research Collaboration on Medical LLMs', 'IIT Delhi · Dept of CSE', 'research', 'New Delhi · Hybrid', 'Rolling', ARRAY['Python', 'Deep Learning', 'LLMs', 'NLP', 'PyTorch'], 'Interdisciplinary research on domain-adapted large language models for medical diagnostics and clinical notes summarization.', '/opportunities'),
('Senior AI Researcher (GenAI & Multimodal)', 'Tathastu AI Labs', 'research', 'Bengaluru · Remote Friendly', '3 weeks left', ARRAY['Python', 'Machine Learning', 'PyTorch', 'LLMs', 'Deep Learning'], 'Leading next-generation multimodal agent systems, reasoning benchmarks, and continuous estimation frameworks.', '/opportunities'),
('AI Grant: Trustworthy Autonomous Systems', 'SERB India', 'grant', 'National', 'Next Month', ARRAY['AI/ML', 'Research', 'Computer Vision', 'Robotics'], 'National research grant supporting verifiable safety and alignment for autonomous systems and robotics.', '/opportunities'),
('Applied AI Research Intern', 'Google Research India', 'internship', 'Bengaluru · Hybrid', '10 days left', ARRAY['Python', 'Machine Learning', 'Deep Learning', 'Algorithms'], 'Research internship focusing on foundational models, low-resource NLP, and algorithmic efficiency.', '/internships'),
('Computer Vision & Edge AI Intern', 'Adobe Research', 'internship', 'Noida · On-site', '2 weeks left', ARRAY['Computer Vision', 'Python', 'PyTorch', 'Deep Learning'], 'Developing state-of-the-art vision models for generative editing and edge compute optimization.', '/internships'),
('LLM Systems Engineering Intern', 'NVIDIA', 'internship', 'Pune · Remote', '5 days left', ARRAY['Python', 'LLMs', 'MLOps', 'CUDA', 'Docker'], 'Engineering high-throughput inference engines and distributed pipeline optimizations for enterprise LLM deployments.', '/internships');
