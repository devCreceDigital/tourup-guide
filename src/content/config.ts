import { defineCollection, z } from 'astro:content';

// ─── Companies ────────────────────────────────────────────────────────────────
// Journey 4: Trust Card – each company exposes ratings, licenses, FAQs, B2B profile
// and NAP data for AEO / Google AI Overviews / LocalBusiness JSON-LD.
const companies = defineCollection({
	type: 'content',
	schema: z.object({
		type: z.literal('company'),
		title: z.string(),                   // brand name (display)
		distribution_role: z.enum([
			'tour_operator',
			'retail_travel_agency',
			'wholesale_travel_agency',
			'online_travel_agency',
			'dmc',
			'mixed_agency',
			'lodging',
		]).optional().default('tour_operator'),
		// Origen de la ficha cuando no viene del registro MINCETUR: 'tourverificado' = creada a
		// partir de una certificación de sostenibilidad (ver scripts/create-certified-profiles.py).
		profile_source: z.literal('tourverificado').optional(),
		sales_channel: z.enum(['online', 'offline', 'omnichannel']).optional(),
		summary: z.string(),                 // 1-2 sentence answer-first blurb for AEO

		// ── Geo / category taxonomy ──────────────────────────────────────────
		destinos: z.array(z.string()).optional(),       // slugs: ["cusco", "lima"]
		categorias: z.array(z.string()).optional(),     // slugs: ["tours-comunitarios", "full-day"]

		// ── Trust signals (Journey 4) ────────────────────────────────────────
		rating: z.number().min(0).max(5).optional(),
		reviews_count: z.number().int().nonnegative().optional(),
		testimonials: z.array(z.object({
			author: z.string(),
			text: z.string(),
			date: z.string().optional(),
			source: z.string().optional(),   // e.g. "TripAdvisor", "Google"
		})).optional(),

		// Formal licenses/registrations (MINCETUR, RUC, IATA, etc.)
		licenses: z.array(z.object({
			type: z.string(),                // e.g. "MINCETUR", "RUC", "IATA"
			id: z.string(),
			issuer: z.string().optional(),
		})).optional(),

		// NAP – Name/Address/Phone (consistent across web for Local SEO)
		nap: z.object({
			address: z.string().optional(),
			city: z.string(),
			country: z.string().default('Peru'),
			phone: z.string().optional(),
			email: z.string().email().optional(),
			website: z.string().url().optional(),
		}).optional(),

		// B2B positioning string (used on Trust Card and Partner Scout shortlist)
		b2b_profile: z.string().optional(),  // e.g. "Receptivo comunitario, grupos 2-12 pax"

		// FAQs rendered as FAQPage JSON-LD on the Trust Card
		faq: z.array(z.object({
			question: z.string(),
			answer: z.string(),
		})).optional(),

		// Quantitative B2B trust metrics
		trust_metrics: z.object({
			avg_response_time_hours: z.number().optional(),
			incident_rate: z.number().min(0).max(1).optional(),  // 0–1 ratio
			group_capacity_max: z.number().int().optional(),
			b2b_client_types: z.array(z.string()).optional(),    // ["agencias", "dmc", "ota"]
			languages: z.array(z.string()).optional(),
		}).optional(),

		// ── Legacy / original fields (kept for backward compat) ─────────────
		contact: z.object({
			website: z.string().optional(),
			email: z.string().email().optional().or(z.string().optional()),
			phone: z.string().optional(),
			phone_alt_1: z.string().optional(),
			phone_alt_2: z.string().optional(),
		}).optional().nullable(),
		location: z.object({
			city: z.string().optional(),
			province: z.string().optional(),
			region: z.string().optional(),
			country: z.string().default('Peru'),
			ubigeo_code: z.string().optional(),
			street_type: z.string().optional().nullable(),
			street_name: z.string().optional().nullable(),
			street_number: z.string().optional().nullable(),
			unit: z.string().optional().nullable(),
		}).optional().nullable(),
		regulation: z.object({
			tax_id: z.string().optional(),
			license_number: z.string().optional(),
			license_issue_date: z.string().optional(),
			// Fecha (AAAAMMDD) del registro oficial del que salen los datos de la ficha.
			snapshot_date: z.string().optional().nullable(),
		}).optional().nullable(),
		legal_representative: z.string().optional(),
		mentioned_in_prompts: z.array(z.string()).optional(),
	}),
});

// ─── Destinos ─────────────────────────────────────────────────────────────────
// Intermediate taxonomy node: Home → Destino → CategoriaDestino → Empresa
// Required for Graphify to build the geo hierarchy and for Partner Scout filters.
const destinoFields = {
	type: z.literal('destino'),
	name: z.string(),
	country: z.string().default('Peru'),
	region: z.string().optional(),
	summary: z.string(),
	parent: z.string().optional(),
	seo_title: z.string().optional(),
	lang: z.string().default('es'),
	faq: z.array(z.object({
		question: z.string(),
		answer: z.string(),
	})).optional(),
};

const destinos = defineCollection({
	type: 'content',
	schema: z.object(destinoFields),
});

const destinos_en = defineCollection({
	type: 'content',
	schema: z.object({ ...destinoFields, lang: z.string().default('en') }),
});

// ─── Categorias Destino ───────────────────────────────────────────────────────
// Second taxonomy level: ties a category (tours, hotels, etc.) to a specific destino.
// Allows queries like "tours comunitarios en Cusco" without relying on free text.
const categorias_destino = defineCollection({
	type: 'content',
	schema: z.object({
		type: z.literal('categoria_destino'),
		destino_slug: z.string(),              // e.g. "cusco"
		categoria: z.string(),                 // e.g. "tours-comunitarios"
		name: z.string(),
		summary: z.string(),
		faq: z.array(z.object({
			question: z.string(),
			answer: z.string(),
		})).optional(),
	}),
});

// ─── External Brands ─────────────────────────────────────────────────────────
const external_brands = defineCollection({
	type: 'content',
	schema: z.object({
		type: z.literal('external_brand'),
		name: z.string(),
		official_url: z.string().url(),
		brand_role: z.string().optional(),
		country: z.string().optional(),
		mentioned_in_prompts: z.array(z.string()).optional(),
	}),
});

// ─── Prompts (English) ────────────────────────────────────────────────────────
// AEO prompt landing pages – answer queries that LLMs receive about Peru tourism.
const prompts = defineCollection({
	type: 'content',
	schema: z.object({
		type: z.literal('prompt_landing'),
		title: z.string(),
		lang: z.string().default('en'),
		search_term: z.string().optional(),
		ai_platforms: z.array(z.string()),
		prompt_text: z.string(),
		primary_intent: z.string().optional(),
		secondary_intent: z.string().optional(),
		destination_cluster: z.string().optional(),
		category_cluster: z.string().optional(),
		brands_ai_mentions: z.array(
			z.union([
				z.string(),
				z.object({
					name: z.string(),
					entity_type: z.enum(['company', 'external_brand', 'unknown']),
					entity_slug: z.string().optional(),
				})
			])
		).optional().default([]),
		summary: z.string(),
		parent: z.string().optional(),
		last_ai_check_date: z.string().optional(),
		ai_cited_domains: z.array(z.string()).optional(),
	}),
});

// ─── Prompts (Spanish) ────────────────────────────────────────────────────────
const prompts_es = defineCollection({
	type: 'content',
	schema: z.object({
		type: z.literal('prompt_landing'),
		title: z.string(),
		lang: z.string().default('es'),
		search_term: z.string().optional(),
		ai_platforms: z.array(z.string()),
		prompt_text: z.string(),
		primary_intent: z.string().optional(),
		secondary_intent: z.string().optional(),
		destination_cluster: z.string().optional(),
		category_cluster: z.string().optional(),
		brands_ai_mentions: z.array(
			z.union([
				z.string(),
				z.object({
					name: z.string(),
					entity_type: z.enum(['company', 'external_brand', 'unknown']),
					entity_slug: z.string().optional(),
				})
			])
		).optional().default([]),
		summary: z.string(),
		parent: z.string().optional(),
		last_ai_check_date: z.string().optional(),
		ai_cited_domains: z.array(z.string()).optional(),
	}),
});

// ─── Posts ───────────────────────────────────────────────────────────────────
const posts = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
		tags: z.array(z.string()),
	}),
});

export const collections = {
	companies,
	destinos,
	destinos_en,
	categorias_destino,
	external_brands,
	prompts,
	prompts_es,
	posts,
};
