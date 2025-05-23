import React, { ReactNode } from "react";

/**
 * Joins an array of JSX elements with a specified separator.
 *
 * @param elements - The array of JSX elements to join.
 * @param separator - The separator to insert between elements. Can be a string or JSX.
 * @returns A single JSX fragment containing the joined elements.
 */
export function joinJSX(elements: ReactNode[], separator: ReactNode): ReactNode {
  if (elements.length === 0) return null;

  return elements.reduce<ReactNode[]>((acc, element, index) => {
    if (index > 0) {
      acc.push(<React.Fragment key={`sep-${index}`}>{separator}</React.Fragment>);
    }
    acc.push(<React.Fragment key={`el-${index}`}>{element}</React.Fragment>);
    return acc;
  }, []);
}
