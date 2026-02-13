import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { evaluate } from "mathjs";

const Calculator = () => {
  const [input, setInput] = useState("");

  const handleButtonClick = (value: string) => {
    setInput((prev) => prev + value);
  };

  const calculateResult = () => {
    try {
      // Use mathjs to safely evaluate the expression
      const result = evaluate(input);
      setInput(result.toString());
    } catch {
      setInput("Error");
    }
  };

  const clearInput = () => {
    setInput("");
  };

  return (
    <div className="calculator bg-card p-4 rounded shadow-md">
      <div className="display bg-background p-2 mb-4 text-right text-lg border border-border rounded">
        {input || "0"}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          "7",
          "8",
          "9",
          "/",
          "4",
          "5",
          "6",
          "*",
          "1",
          "2",
          "3",
          "-",
          "0",
          ".",
          "=",
          "+",
        ].map((char) => (
          <Button
            key={char}
            variant="outline"
            onClick={() =>
              char === "=" ? calculateResult() : handleButtonClick(char)
            }
          >
            {char}
          </Button>
        ))}
        <Button
          variant="destructive"
          onClick={clearInput}
          className="col-span-4"
        >
          Clear
        </Button>
      </div>
    </div>
  );
};

export default Calculator;
