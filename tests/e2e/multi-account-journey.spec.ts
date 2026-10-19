import { test, expect } from "@playwright/test";

test.describe("Full Journey: Two-Account Isolation, Navigation & UX", () => {
  test("Account A and Account B data isolation & mobile-ready navigation", async ({ browser }) => {
    // =========================================================================
    // 1. ACCOUNT A JOURNEY
    // =========================================================================
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // 1.1 Visit Welcome Page
    await pageA.goto("/welcome");
    await expect(pageA).toHaveTitle(/Deep Roots/i);
    const continueBtn = pageA.locator("button:has-text('Continue')");
    await expect(continueBtn).toBeVisible();

    // Click Skip for now to complete welcome onboarding and proceed to home
    const skipBtn = pageA.locator("button:has-text('Skip for now')");
    await skipBtn.click();
    await pageA.waitForURL("/");

    // 1.2 Verify Home Page loaded with top greeting and seeded content
    await expect(pageA.locator("h1, h2").first()).toBeVisible();
    const bodyA = await pageA.textContent("body");
    expect(bodyA).toBeTruthy();

    // 1.3 Visit Tree View
    await pageA.goto("/tree");
    await pageA.waitForTimeout(800);
    const treeView = pageA.locator("svg, canvas, div[data-tree-container]").first();
    await expect(treeView).toBeVisible();

    // 1.4 Seed an Account A private discovery into localStorage
    const accountADiscovery = {
      id: "root-account-a-exclusive-101",
      depth: 0,
      inputKind: "text",
      title: "Roman Aqueduct Pozzolana Hydraulic Siphon",
      lenses: ["tech", "origins"],
      createdAt: new Date().toISOString(),
      card: {
        title: "Roman Aqueduct Pozzolana Hydraulic Siphon",
        oneLiner: "Inverted siphons allowing high-pressure valleys to be crossed without monumental arches.",
        root: {
          headline: "Vitruvius documented lead pipe inverted siphons with venter structures.",
          body: "High hydrostatic pressure was managed using thick cast lead siphon tubes.",
          claimIds: ["c1"],
          lens: "tech",
        },
        layers: [
          {
            name: "Hydrostatic Physics",
            summary: "Communicating vessels principle across river valleys.",
            claimIds: ["c1"],
            lens: "tech",
          },
        ],
        components: [
          {
            name: "Venter Bridge",
            role: "Low horizontal substructure supporting the siphon sag point",
            hiddenFact: "Built to decrease static pressure head on lead joints.",
            claimIds: ["c1"],
          },
          {
            name: "Header Tank",
            role: "Intake reservoir transitioning open channel to pressurized pipe",
            hiddenFact: "Equipped with sediment settling chambers.",
            claimIds: ["c1"],
          },
          {
            name: "Receiving Tank",
            role: "Outlet calming basin",
            hiddenFact: "Dissipated kinetic energy before resuming open flume flow.",
            claimIds: ["c1"],
          },
        ],
        claims: [
          {
            id: "c1",
            text: "Roman siphon pipes at Lyon withstood over 18 atmospheres of water pressure.",
            status: "established",
            evidenceStatus: "supported",
            sources: [],
          },
        ],
        lenses: ["tech", "origins"],
        rabbitHoles: [],
        nextQuestions: [],
        concepts: [{ label: "Inverted Siphons", lens: "tech" }],
      },
    };

    await pageA.evaluate((disc) => {
      const existing = JSON.parse(localStorage.getItem("deeproots_guest_roots") || "[]");
      localStorage.setItem("deeproots_guest_roots", JSON.stringify([disc, ...existing]));
      window.dispatchEvent(new Event("deeproots_storage_updated"));
    }, accountADiscovery);

    // Refresh pageA to verify discovery survived refresh
    await pageA.goto("/root/root-account-a-exclusive-101");
    await pageA.waitForTimeout(600);
    const titleA = await pageA.textContent("body");
    expect(titleA).toContain("Roman Aqueduct Pozzolana Hydraulic Siphon");

    // 1.5 Visit Profile page and verify sync UI
    await pageA.goto("/profile");
    await pageA.waitForTimeout(500);
    const profileTextA = await pageA.textContent("body");
    expect(profileTextA).toContain("Profile");
    expect(profileTextA).toContain("Roots");

    // Cleanly close Account A context
    await contextA.close();

    // =========================================================================
    // 2. ACCOUNT B JOURNEY (Isolated context: no cookies or storage from Account A)
    // =========================================================================
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    // Set welcomed=true for Account B
    await pageB.addInitScript(() => {
      localStorage.setItem("deeproots_welcomed", "true");
    });

    // 2.1 Visit Home Page on Account B
    await pageB.goto("/");
    await pageB.waitForTimeout(600);
    const bodyB = await pageB.textContent("body");

    // VERIFY: Account B cannot see Account A's exclusive discovery!
    expect(bodyB).not.toContain("Roman Aqueduct Pozzolana Hydraulic Siphon");

    // 2.2 Account B visits /root/root-account-a-exclusive-101
    await pageB.goto("/root/root-account-a-exclusive-101");
    await pageB.waitForTimeout(500);
    const rootPageTextB = await pageB.textContent("body");

    // Under client data isolation, Account B does NOT have Account A's root in local storage
    const hasLeak = rootPageTextB?.includes("Roman Aqueduct Pozzolana Hydraulic Siphon");
    expect(hasLeak).toBe(false);

    // 2.3 Account B creates their own separate discovery
    const accountBDiscovery = {
      id: "root-account-b-exclusive-202",
      depth: 0,
      inputKind: "text",
      title: "Magnetic Levitation Inductrack",
      lenses: ["tech", "money"],
      createdAt: new Date().toISOString(),
      card: {
        title: "Magnetic Levitation Inductrack",
        oneLiner: "Passive permanent magnet Halbach arrays achieving levitation over unpowered coils.",
        root: {
          headline: "Richard Post invented Inductrack using permanent neodymium magnets.",
          body: "Unlike cryogenic superconducting maglev, Inductrack achieves passive levitation above a critical lift-off speed.",
          claimIds: ["c1"],
          lens: "tech",
        },
        layers: [
          {
            name: "Halbach Array Geometry",
            summary: "Rotating magnetic orientation concentrating field on one side.",
            claimIds: ["c1"],
            lens: "tech",
          },
        ],
        components: [
          {
            name: "Halbach Magnet Bar",
            role: "Concentrates magnetic flux downward",
            hiddenFact: "Cancels magnetic field on upper side while doubling it on the track side.",
            claimIds: ["c1"],
          },
          {
            name: "Passive Litz Wire Track",
            role: "Induces repulsive eddy currents",
            hiddenFact: "Requires no track power; electricity is induced by vehicle speed.",
            claimIds: ["c1"],
          },
          {
            name: "Auxiliary Wheels",
            role: "Low-speed runway support below lift-off velocity",
            hiddenFact: "Retract once speed exceeds roughly 20 miles per hour.",
            claimIds: ["c1"],
          },
        ],
        claims: [
          {
            id: "c1",
            text: "Inductrack was patented at Lawrence Livermore National Laboratory in 1998.",
            status: "established",
            evidenceStatus: "supported",
            sources: [],
          },
        ],
        lenses: ["tech", "money"],
        rabbitHoles: [],
        nextQuestions: [],
        concepts: [{ label: "Halbach Arrays", lens: "tech" }],
      },
    };

    await pageB.evaluate((disc) => {
      const existing = JSON.parse(localStorage.getItem("deeproots_guest_roots") || "[]");
      localStorage.setItem("deeproots_guest_roots", JSON.stringify([disc, ...existing]));
      window.dispatchEvent(new Event("deeproots_storage_updated"));
    }, accountBDiscovery);

    // Verify Account B's root opens on pageB
    await pageB.goto("/root/root-account-b-exclusive-202");
    await pageB.waitForTimeout(600);
    const titleB = await pageB.textContent("body");
    expect(titleB).toContain("Magnetic Levitation Inductrack");

    // 2.4 Account B visits /tree
    await pageB.goto("/tree");
    await pageB.waitForTimeout(800);
    const treeViewB = pageB.locator("svg, canvas, div[data-tree-container]").first();
    await expect(treeViewB).toBeVisible();

    // Close Account B context
    await contextB.close();
  });

  // =========================================================================
  // 3. MOBILE VIEWPORT & GRAPH NAVIGATION
  // =========================================================================
  test("Mobile navigation, bottom tab bar and responsive layout", async ({ browser }) => {
    // iPhone 14 Pro viewport dimensions
    const mobileContext = await browser.newContext({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    });

    const page = await mobileContext.newPage();

    // Set welcomed=true so home tab and layout load directly
    await page.addInitScript(() => {
      localStorage.setItem("deeproots_welcomed", "true");
    });

    // 3.1 Verify Bottom Tab Bar on mobile
    await page.goto("/");
    await page.waitForTimeout(600);

    // Tab bar should be visible at bottom
    const homeTab = page.locator("a[href='/']").first();
    const treeTab = page.locator("a[href='/tree']").first();
    const scanTab = page.locator("a[href='/scan']").first();

    await expect(homeTab).toBeVisible();
    await expect(treeTab).toBeVisible();
    await expect(scanTab).toBeVisible();

    // 3.2 Mobile Navigation to Scan Page
    await scanTab.click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("/scan");

    // Check mode buttons
    const photoMode = page.locator("button:has-text('Photo')");
    const typeMode = page.locator("button:has-text('Type')");
    const linkMode = page.locator("button:has-text('Link')");

    await expect(photoMode).toBeVisible();
    await expect(typeMode).toBeVisible();
    await expect(linkMode).toBeVisible();

    // Click Type tab
    await typeMode.click();
    const textarea = page.locator("textarea[placeholder*='snack'], textarea[placeholder*='Sourdough']").or(page.locator("textarea"));
    await expect(textarea.first()).toBeVisible();

    // 3.3 Exit Scan viewfinder back to main app and navigate via Bottom Tab Bar
    const exitBtn = page.locator("button:has(svg.lucide-x)").first();
    await exitBtn.click();
    await page.waitForTimeout(500);

    // Bottom tab bar is now active again
    await expect(treeTab).toBeVisible();
    await treeTab.click();
    await page.waitForTimeout(600);
    expect(page.url()).toContain("/tree");

    const treeContainer = page.locator("svg, canvas, div[data-tree-container]").first();
    await expect(treeContainer).toBeVisible();

    await mobileContext.close();
  });
});
