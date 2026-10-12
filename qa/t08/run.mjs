// Current integration gate; original S5 harness preserved alongside as .s5-source.
process.argv[2] ||= 'contracts'
await import('../../scripts/run-ci.mjs')
