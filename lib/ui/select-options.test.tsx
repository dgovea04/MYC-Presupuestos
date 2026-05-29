import { describe, expect, it } from "vitest";
import { Children, Fragment } from "react";
import { extractSelectOptions, partitionSelectOptions } from "@/lib/ui/select-options";

describe("extractSelectOptions", () => {
  it("extracts flat options including disabled placeholder entries", () => {
    const children = Children.toArray([
      <option key="empty" value="" disabled>
        Selecciona una opcion
      </option>,
      <option key="a" value="A">
        Opcion A
      </option>,
      <option key="b" value="B">
        Opcion B
      </option>,
    ]);

    expect(extractSelectOptions(children)).toEqual([
      { value: "", label: "Selecciona una opcion", disabled: true, tone: "default" },
      { value: "A", label: "Opcion A", disabled: false, tone: "default" },
      { value: "B", label: "Opcion B", disabled: false, tone: "default" },
    ]);
  });

  it("separates disabled empty placeholders from renderable options", () => {
    const options = [
      { value: "", label: "Selecciona una opcion", disabled: true, tone: "default" },
      { value: "A", label: "Opcion A", disabled: false, tone: "default" },
      { value: "B", label: "Opcion B", disabled: false, tone: "default" },
    ];

    expect(partitionSelectOptions(options)).toEqual({
      placeholderOption: { value: "", label: "Selecciona una opcion", disabled: true, tone: "default" },
      renderableOptions: [
        { value: "A", label: "Opcion A", disabled: false, tone: "default" },
        { value: "B", label: "Opcion B", disabled: false, tone: "default" },
      ],
    });
  });

  it("extracts intrinsic option nodes nested through fragments", () => {
    const children = (
      <>
        <Fragment>
          <option value="A">Opcion A</option>
          <>
            <option value="B">Opcion B</option>
          </>
        </Fragment>
        <div>
          <option value="C">Opcion C</option>
        </div>
      </>
    );

    expect(extractSelectOptions(children)).toEqual([
      { value: "A", label: "Opcion A", disabled: false, tone: "default" },
      { value: "B", label: "Opcion B", disabled: false, tone: "default" },
      { value: "C", label: "Opcion C", disabled: false, tone: "default" },
    ]);
  });

  it("extracts warning tone metadata from option data attributes", () => {
    expect(
      extractSelectOptions(
        <option value="A" data-tone="warning">
          Opcion A
        </option>,
      ),
    ).toEqual([{ value: "A", label: "Opcion A", disabled: false, tone: "warning" }]);
  });
});
