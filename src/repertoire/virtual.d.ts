declare module "virtual:repertoire" {
  const graphs: {
    white: import("./types").Graph;
    black: import("./types").Graph;
  };
  export default graphs;
}
