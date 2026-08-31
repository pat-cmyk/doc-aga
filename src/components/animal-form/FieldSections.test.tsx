import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BreedFields } from "./BreedFields";
import { AcquisitionFields } from "./AcquisitionFields";
import { ParentageFields } from "./ParentageFields";

const BREEDS = ["Holstein", "Sahiwal", "Mix Breed"] as const;

describe("BreedFields (shared by AnimalForm + EditAnimalDialog)", () => {
  it("renders the breed selector", () => {
    render(
      <BreedFields
        value={{ breed: "", breed1: "", breed2: "" }}
        onChange={vi.fn()}
        availableBreeds={BREEDS}
      />,
    );
    expect(screen.getByText("Breed")).toBeInTheDocument();
    expect(screen.queryByText("First Breed")).toBeNull();
  });

  it("shows mix-breed selectors with inline errors when Mix Breed is chosen", () => {
    render(
      <BreedFields
        value={{ breed: "Mix Breed", breed1: "", breed2: "" }}
        onChange={vi.fn()}
        availableBreeds={BREEDS}
        errors={{ breed1: "First breed is required" }}
      />,
    );
    expect(screen.getByText("First Breed")).toBeInTheDocument();
    expect(screen.getByText("Second Breed")).toBeInTheDocument();
    expect(screen.getByText("First breed is required")).toBeInTheDocument();
  });
});

describe("AcquisitionFields (shared by AnimalForm + EditAnimalDialog)", () => {
  const base = {
    acquisition_type: "purchased",
    purchase_price: "",
    grant_source: "",
    grant_source_other: "",
    source_farm: "",
  };

  it("shows purchase price for purchased animals and Source Farm always", () => {
    render(<AcquisitionFields value={base} onChange={vi.fn()} />);
    expect(screen.getByText("Purchase Price (PHP)")).toBeInTheDocument();
    expect(screen.getByText("Source Farm")).toBeInTheDocument();
    expect(screen.queryByText("Grant Source")).toBeNull();
  });

  it("shows grant fields (incl. 'other' input + error) for grants", () => {
    render(
      <AcquisitionFields
        value={{ ...base, acquisition_type: "grant", grant_source: "other" }}
        onChange={vi.fn()}
        errors={{ grant_source_other: "Please specify the source" }}
      />,
    );
    expect(screen.getByText("Grant Source")).toBeInTheDocument();
    expect(screen.getByText("Specify Source")).toBeInTheDocument();
    expect(screen.getByText("Please specify the source")).toBeInTheDocument();
    expect(screen.queryByText("Purchase Price (PHP)")).toBeNull();
  });
});

describe("ParentageFields (shared by AnimalForm + EditAnimalDialog)", () => {
  const base = {
    mother_id: "",
    father_id: "",
    is_father_ai: false,
    ai_bull_brand: "",
    ai_bull_reference: "",
    ai_bull_breed: "",
  };
  const parents = [{ id: "p1", name: "Bella", ear_tag: "A001" }];

  it("renders mother/father selectors", () => {
    render(
      <ParentageFields
        value={base}
        onChange={vi.fn()}
        mothers={parents}
        fathers={parents}
        availableBreeds={BREEDS}
      />,
    );
    expect(screen.getByText("Mother")).toBeInTheDocument();
    expect(screen.getByText("Father")).toBeInTheDocument();
    expect(screen.queryByText("Bull Semen Brand")).toBeNull();
  });

  it("shows the AI bull fields with inline error when the father is AI", () => {
    render(
      <ParentageFields
        value={{ ...base, is_father_ai: true }}
        onChange={vi.fn()}
        mothers={parents}
        fathers={parents}
        availableBreeds={BREEDS}
        errors={{ ai_bull_breed: "AI bull breed is required" }}
      />,
    );
    expect(screen.getByText("Bull Semen Brand")).toBeInTheDocument();
    expect(screen.getByText("Bull Reference/Name")).toBeInTheDocument();
    expect(screen.getByText("AI bull breed is required")).toBeInTheDocument();
  });

  it("shows a loading state while parents load", () => {
    render(
      <ParentageFields
        value={base}
        onChange={vi.fn()}
        mothers={[]}
        fathers={[]}
        availableBreeds={BREEDS}
        loading
      />,
    );
    expect(screen.getByText("Loading parents...")).toBeInTheDocument();
  });
});
