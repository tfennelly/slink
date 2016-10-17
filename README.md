The idea of `npm link` is great - link a package under development into another package that uses it, allowing you
test the changes being made to the package being linked. The problem with `npm link` is that it is a notorious
PITA because of two things:

1. It's just a `symlink` to the package source: meaning that it has a full-blown `node_modules` (not deduped), causing problems with local package resolution.
1. It's just a `symlink` to the package source: meaning `require` resolution happens against the `symlink`s real path, which screws everything up most of the time.


So in most cases `npm link` simply does not work.

This package (`slink`) tries to provide a dev time mechanism that allows you to "slink" a package under development into
another package that uses it, allowing you to test the changes being made to the package under development. So, the "use case" is
basically the same as `npm link`.

The difference is that it doesn't use any `symlink`s and so doesn't have either of the issues listed above. It watches
the source in the slinked package (under dev) and "synchronizes" any changes as they happen. But, it does __NOT__ touch the
contents of the `node_modules` directory.

# Install

```sh
npm install -g slink
```

# Usage

`slink` requires you to start by installing the package(s) under development (e.g. "A") into the package in which you will be testing
the changes to "A" (e.g. "B"). Once "A" is installed, "B" will have a properly deduped "A" in it's `node_modules` dir. Now you can
`slink` in "B", telling it to watch for and synchronize source changes in "A" into `node_modules/A`.

e.g.

`npm install` "A" in "B": 

```sh
tfennelly@diego:~/projects/B $ npm install ../A
```

`slink` "A" in "B" and make a source change to `../A/index.js`: 

```sh
tfennelly@diego:~/projects/B $ slink ../A
Watching for changes in /Users/tfennelly/projects/A
    ./index.js changes synchronized.
```

In the above case `slink` sits and watches for changes in `../A`.

> Note: You can also `slink` using the package name (i.e. not a relative path). This works so long as the package being `slink`d has been `npm link`d.

> Note: If `../A/package.json` contains a `files` spec, that spec will be honoured i.e. only files covered by the spec will be synchronized.

> Note: You can specify multiple packages to be "slinked" e.g. `slink ../X ../Y ../Z`