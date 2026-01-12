"use client";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "./ui/button";

const Header = () => {
  return (
    <div className="flex justify-between items-center my-6">
      <h1 className="text-2xl font-bold">Logo</h1>
      <nav>
        <Authenticated>
          <UserButton />
        </Authenticated>
        <Unauthenticated>
          <SignInButton mode="modal">
            <Button className="cursor-pointer" size={"sm"}>
              Get Started
            </Button>
          </SignInButton>
        </Unauthenticated>
      </nav>
    </div>
  );
};

export default Header;
