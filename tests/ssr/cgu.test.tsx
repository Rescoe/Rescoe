/**
 * La page CGU doit se rendre côté serveur : pas de `window` pendant le rendu,
 * et le contenu légal + le lien de téléchargement doivent être présents dans le HTML initial.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ChakraProvider } from "@chakra-ui/react";
import CGUPage from "@/components/containers/home/CGU";

describe("CGU — rendu serveur", () => {
  it("s'exécute sans window ni document (environnement Node)", () => {
    expect(typeof window).toBe("undefined");
    expect(() => renderToString(<ChakraProvider><CGUPage /></ChakraProvider>)).not.toThrow();
  });

  it("contient le titre et le lien PDF dans le HTML initial, sans iframe tant que l'origine est inconnue", () => {
    const html = renderToString(<ChakraProvider><CGUPage /></ChakraProvider>);
    expect(html).toContain("Conditions Générales d");
    expect(html).toContain('href="/CGU_Rescoe_17032026.pdf"');
    expect(html).not.toContain("<iframe");
  });
});
