import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GeneIcon, geneIconNames } from "./GeneIcon";

function expectSelfContained(svg: Element) {
  expect(svg.querySelector("path, circle, ellipse, rect, polygon")).not.toBeNull();
  expect(svg.querySelector("use, image")).toBeNull();
  const ids = new Set([...svg.querySelectorAll("[id]")].map(node => node.id));
  for (const node of svg.querySelectorAll("[fill], [stroke]")) {
    for (const value of [node.getAttribute("fill"), node.getAttribute("stroke")]) {
      for (const [, id] of (value ?? "").matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(id)).toBe(true);
    }
  }
}

describe("GeneIcon visibility", () => {
  it("renders every supplied icon with local geometry and no external image dependency", () => {
    const { container } = render(<>{geneIconNames.map(name => <GeneIcon key={name} name={name} />)}</>);
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBe(geneIconNames.length);
    icons.forEach(expectSelfContained);
  });

  it("keeps visible icons independent from hidden and repeated copies and after navigation", () => {
    const view = (name: string) => <><div hidden><GeneIcon name={name} /></div><GeneIcon name={name} title="Visible" /><GeneIcon name={name} /></>;
    const { container, rerender } = render(view("marriage"));
    for (const name of ["marriage", "birth", "home"]) {
      rerender(view(name));
      const ids = [...container.querySelectorAll("[id]")].map(node => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      container.querySelectorAll("svg").forEach(expectSelfContained);
      expect(screen.getByRole("img", { name: "Visible" })).toBeVisible();
    }
  });

  it("retains an accessible fallback, sizing and refs for unknown icon names", () => {
    const ref = createRef<SVGSVGElement>();
    render(<GeneIcon ref={ref} name="missing-artwork" title="Sugerencias" size={32} />);
    const svg = screen.getByRole("img", { name: "Sugerencias" });
    expect(ref.current).toBe(svg);
    expect(svg).toHaveAttribute("width", "32");
    expectSelfContained(svg);
  });
});
