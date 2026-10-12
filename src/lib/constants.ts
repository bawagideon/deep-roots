import { Lens, StoredRoot, GraphEdge } from "@/types/roots";

export interface LensInfo {
  id: Lens;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export const LENSES: Record<Lens, LensInfo> = {
  language: {
    id: "language",
    label: "Language",
    shortLabel: "Lang",
    color: "#7FB8FF",
    description: "Words, names, and the origins of terms",
  },
  culture: {
    id: "culture",
    label: "Culture",
    shortLabel: "Culture",
    color: "#FF9B7A",
    description: "Everyday rituals, customs, food, and human meaning",
  },
  mind: {
    id: "mind",
    label: "Mind & Body",
    shortLabel: "Mind",
    color: "#D4A5FF",
    description: "Biology, psychology, senses, and habits",
  },
  money: {
    id: "money",
    label: "Money",
    shortLabel: "Money",
    color: "#9BE564",
    description: "Economics, pricing, trade, and supply chains",
  },
  tech: {
    id: "tech",
    label: "Tech",
    shortLabel: "Tech",
    color: "#5FE0E8",
    description: "Engineering, materials, fabrication, and tools",
  },
  origins: {
    id: "origins",
    label: "Origins",
    shortLabel: "Origins",
    color: "#FF86B8",
    description: "History, deep evolution, and beginnings",
  },
};

export const SEEDED_ROOTS: StoredRoot[] = [
  {
    id: "root-noodles",
    depth: 0,
    inputKind: "photo",
    title: "Instant noodles",
    lenses: ["tech", "language", "origins", "money"],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    isSeeded: true,
    card: {
      title: "Instant noodles",
      oneLiner: "A fried, dried wheat block with a flavour sachet, built to be ready in minutes.",
      inputKind: "photo",
      inputSummary: "Square packaged block of instant ramen noodles with soup powder sachet.",
      root: {
        headline: "Instant noodles were invented to fight postwar hunger.",
        body: "Momofuku Ando created them in Japan in 1958, after seeing long queues for hot noodles during severe postwar food shortages. Flash-frying in palm oil is what lets them store for months.",
        claimIds: ["c1", "c4"],
        lens: "origins",
      },
      layers: [
        {
          name: "Culinary Tech",
          lens: "tech",
          summary: "Flash-frying drives out moisture in seconds, leaving microscopic pores for rapid rehydration.",
          claimIds: ["c1"],
        },
        {
          name: "Sensory & Language",
          lens: "language",
          summary: "The MSG and nucleosides activate the specific receptor identified as umami.",
          claimIds: ["c2"],
        },
        {
          name: "Global Commodity",
          lens: "money",
          summary: "Relies on vast global supply chains of wheat and palm oil across continents.",
          claimIds: ["c3", "c4"],
        },
      ],
      components: [
        {
          name: "Noodle block",
          role: "Wheat flour, flash-fried and dried",
          hiddenFact: "Frying drives out water, leaving microscopic pores so hot water enters in 3 minutes.",
          claimIds: ["c1"],
          layer: "Culinary Tech",
          lens: "tech",
        },
        {
          name: "Seasoning sachet",
          role: "Salt, spices and flavour boosters",
          hiddenFact: "'Umami' was coined in Japan in 1908 by chemist Kikunae Ikeda to name the savoury fifth taste.",
          claimIds: ["c2"],
          layer: "Sensory & Language",
          lens: "language",
        },
        {
          name: "Frying oil",
          role: "Typically refined palm oil",
          hiddenFact: "The oil palm originally comes from West Africa, now cultivated heavily in Southeast Asia.",
          claimIds: ["c3"],
          layer: "Global Commodity",
          lens: "origins",
        },
        {
          name: "Wheat",
          role: "The structural cereal grain",
          hiddenFact: "Wheat grows poorly in hot, humid climates, forcing tropical countries to depend on imports.",
          claimIds: ["c4"],
          layer: "Global Commodity",
          lens: "money",
        },
      ],
      lenses: ["tech", "language", "origins", "money"],
      nextQuestions: [
        {
          text: "Why does flash-frying make noodles porous instead of greasy?",
          kind: "deepen",
          targetComponent: "Noodle block",
        },
        {
          text: "How did palm oil transform from an African sacred oil to a global industrial fat?",
          kind: "cause",
          targetComponent: "Frying oil",
        },
        {
          text: "How does traditional hand-pulled ramen compare with industrial flash-fried noodles?",
          kind: "compare",
        },
      ],
      concepts: [
        { label: "Flash-frying", lens: "tech" },
        { label: "Umami", lens: "language" },
        { label: "Palm oil trade", lens: "money" },
        { label: "Postwar food relief", lens: "origins" },
      ],
      claims: [
        {
          id: "c1",
          text: "Flash-frying in oil evaporates water quickly, creating a porous matrix that absorbs hot water.",
          status: "established",
          sources: [
            {
              title: "World Instant Noodles Association - History and Science",
              url: "https://instantnoodles.org/en/noodles/history.html",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "c2",
          text: "The term 'umami' was coined in Japan in 1908 by chemist Kikunae Ikeda.",
          status: "established",
          sources: [
            {
              title: "Ikeda, K. (1909). New Seasonings. Chemical Society of Tokyo",
              url: "https://www.umamiinfo.com/what/history/",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "c3",
          text: "The African oil palm (Elaeis guineensis) originated in West and Central Africa.",
          status: "established",
          sources: [
            {
              title: "Kew Gardens - Elaeis guineensis (African oil palm)",
              url: "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:666818-1",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "c4",
          text: "Momofuku Ando developed instant noodles after witnessing long lines for food in postwar Osaka.",
          status: "interpretation",
          sources: [
            {
              title: "Nissin Foods Heritage Biography",
              url: "https://www.nissin.com/en_jp/about/history/",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  },
  {
    id: "root-quarantine",
    depth: 0,
    inputKind: "text",
    inputText: "Quarantine",
    title: "Quarantine",
    lenses: ["language", "origins", "culture"],
    createdAt: new Date().toISOString(),
    isSeeded: true,
    card: {
      title: "Quarantine",
      oneLiner: "A word you use that is a number in disguise.",
      inputKind: "text",
      inputSummary: "The word and medical isolation protocol 'quarantine'.",
      root: {
        headline: "The word quarantine comes from the Italian number forty.",
        body: "In 14th-century Venice, ships arriving during the Black Death were forced to anchor offshore for forty days ('quaranta giorni') before crew could come ashore. The practice existed before germ theory.",
        claimIds: ["qc1"],
        lens: "language",
      },
      layers: [
        {
          name: "Maritime Etymology",
          lens: "language",
          summary: "Derives from Venetian dialect 'quarantena', meaning a period of forty days.",
          claimIds: ["qc1"],
        },
        {
          name: "Epidemiological History",
          lens: "origins",
          summary: "Forty days was chosen based on biblical periods of purification and Hippocratic medicine.",
          claimIds: ["qc2"],
        },
      ],
      components: [
        {
          name: "The 40-day window",
          role: "Empirical isolation period",
          hiddenFact: "The Venetian quarantine station (Lazaretto) was built on an island to halt the bubonic plague.",
          claimIds: ["qc1"],
          layer: "Maritime Etymology",
          lens: "origins",
        },
        {
          name: "The maritime bill of health",
          role: "Document proving ports visited",
          hiddenFact: "Ships carried clean bills of health signed by consuls to avoid detention.",
          claimIds: ["qc2"],
          layer: "Epidemiological History",
          lens: "culture",
        },
        {
          name: "Venetian merchant fleet",
          role: "The economic driver of medieval trade",
          hiddenFact: "Trade was so lucrative Venice chose to lose 40 days of crew time rather than stop ships.",
          claimIds: ["qc3"],
          layer: "Epidemiological History",
          lens: "money",
        },
      ],
      lenses: ["language", "origins", "culture"],
      nextQuestions: [
        {
          text: "Why did 14th-century physicians believe forty days was the magic purification number?",
          kind: "cause",
          targetComponent: "The 40-day window",
        },
        {
          text: "How did quarantine stations evolve into modern port customs and border control?",
          kind: "deepen",
        },
        {
          text: "How did Venice's maritime quarantine compare with land-based pestilence lockdowns in Milan?",
          kind: "compare",
        },
      ],
      concepts: [
        { label: "Venetian Lazaretto", lens: "origins" },
        { label: "Black Death maritime trade", lens: "money" },
        { label: "Number symbolism in medicine", lens: "language" },
      ],
      claims: [
        {
          id: "qc1",
          text: "Quarantine derives from Venetian quaranta (forty), the duration ships were isolated in port.",
          status: "established",
          sources: [
            {
              title: "Oxford English Dictionary - quarantine etymology",
              url: "https://www.oed.com/view/Entry/155986",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "qc2",
          text: "Venice established the first permanent plague hospital (Lazzaretto Vecchio) on an island in 1423.",
          status: "established",
          sources: [
            {
              title: "State Archives of Venice - Public Health Records",
              url: "https://www.archiviodistatovenezia.it",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "qc3",
          text: "The choice of 40 days was influenced by Pythagorean doctrine and biblical periods of penance.",
          status: "interpretation",
          sources: [
            {
              title: "Journal of Medical Biography - Quarantine historical origins",
              url: "https://pubmed.ncbi.nlm.nih.gov/12474880/",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  },
  {
    id: "root-plastic-chair",
    depth: 0,
    inputKind: "photo",
    title: "Plastic chair",
    lenses: ["tech", "money", "culture"],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    isSeeded: true,
    card: {
      title: "Plastic chair",
      oneLiner: "The ubiquitous Monobloc: the single most manufactured piece of furniture in human history.",
      inputKind: "photo",
      inputSummary: "White single-piece injection-moulded polypropylene stacking chair.",
      root: {
        headline: "A single mould produces this chair in under 60 seconds with no joints or screws.",
        body: "Known as the Monobloc, it is pressed from molten polypropylene granules in a single hydraulic stroke. Its lack of seams makes it virtually indestructible to weather, costing less than $5 to produce.",
        claimIds: ["pc1"],
        lens: "tech",
      },
      layers: [
        {
          name: "Injection Moulding",
          lens: "tech",
          summary: "Granules are heated to 220°C and forced into a multi-ton CNC-milled steel mould.",
          claimIds: ["pc1"],
        },
        {
          name: "Global Democratization",
          lens: "money",
          summary: "Zero assembly and nestable stacking allow thousands to ship in a single freight container.",
          claimIds: ["pc2"],
        },
      ],
      components: [
        {
          name: "Polypropylene granules",
          role: "Thermoplastic petroleum byproduct",
          hiddenFact: "Recyclable, flexible, and chemically inert against almost all household acids and cleaners.",
          claimIds: ["pc1"],
          layer: "Injection Moulding",
          lens: "tech",
        },
        {
          name: "Stacking draft angle",
          role: "Tapered geometry allowing infinite nesting",
          hiddenFact: "The subtle slant of the legs allows 50 chairs to nest into a tower occupying 1 sq meter.",
          claimIds: ["pc2"],
          layer: "Global Democratization",
          lens: "tech",
        },
        {
          name: "The steel mould",
          role: "Tooling weighing several tons",
          hiddenFact: "A high-precision Monobloc mould can cost over $200,000, but lasts for millions of pressings.",
          claimIds: ["pc3"],
          layer: "Global Democratization",
          lens: "money",
        },
      ],
      lenses: ["tech", "money", "culture"],
      nextQuestions: [
        {
          text: "Why is the Monobloc banned from historic town centres in several European cities?",
          kind: "cause",
        },
        {
          text: "How does polypropylene molecular branching prevent catastrophic cracking under load?",
          kind: "deepen",
          targetComponent: "Polypropylene granules",
        },
        {
          text: "How does the Monobloc's environmental footprint compare with bentwood café chairs?",
          kind: "compare",
        },
      ],
      concepts: [
        { label: "Monobloc", lens: "tech" },
        { label: "Injection moulding", lens: "tech" },
        { label: "Container shipping logistics", lens: "money" },
      ],
      claims: [
        {
          id: "pc1",
          text: "The Monobloc chair is manufactured via injection moulding of polypropylene in a single cycle.",
          status: "established",
          sources: [
            {
              title: "Vitra Design Museum - Monobloc: A chair for the world",
              url: "https://www.design-museum.de/en/exhibitions/detailpages/monobloc.html",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "pc2",
          text: "Millions of units are produced yearly worldwide due to extremely low unit production marginal costs.",
          status: "established",
          sources: [
            {
              title: "Industrial Design History - The Story of the Monobloc",
              url: "https://www.core77.com/posts/37207/The-Story-of-the-Monobloc",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: "pc3",
          text: "The tooling mould for large single-piece furniture requires high-tonnage clamping machinery.",
          status: "established",
          sources: [
            {
              title: "Modern Plastics Worldwide Journal",
              url: "https://www.ptonline.com",
              retrievedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    },
  },
];

export const SEEDED_EDGES: GraphEdge[] = [
  {
    id: "edge-1",
    fromRoot: "root-noodles",
    toRoot: "root-plastic-chair",
    type: "unexpected",
    why: "Both products rely on mass petroleum derivatives: palm oil transport and polypropylene synthesis.",
    limits: "Noodles are consumed foodstuff, while chairs are durable thermoplastic goods.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "edge-2",
    fromRoot: "root-quarantine",
    toRoot: "root-noodles",
    type: "shared_concept",
    why: "Both emerged directly as institutional responses to acute civic crises: epidemics and postwar famine.",
    createdAt: new Date().toISOString(),
  },
];
