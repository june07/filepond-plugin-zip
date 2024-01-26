import * as pkg from './package.json' assert {type: "json"}
import build from './rollup.scripts.js'

export default build(
    {
        id: 'FilePondPluginZip',
        ...pkg
    },
    [
        {
            format: 'umd',
            transpile: true
        },
        {
            format: 'umd',
            transpile: true,
            minify: true
        },
        {
            format: 'es'
        },
        {
            format: 'es',
            minify: true
        }
    ]
)