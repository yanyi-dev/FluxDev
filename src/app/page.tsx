"use client";

import { Button } from "@/components/ui/button";

const x = () => {
  const handle = async () => {
    const text = await fetch("/api/demo", { method: "POST" });
    console.log(text);
  };
  return <Button onClick={handle}>hello</Button>;
};

export default x;
