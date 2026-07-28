import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone", //after building, work out exactly which files the server needs to run, and put just those in one folder
};

export default nextConfig;
