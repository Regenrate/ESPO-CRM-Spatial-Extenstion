import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default [
    {
        input: 'node_modules/leaflet/dist/leaflet-src.esm.js',
        output: {
            file: 'build/assets/lib/leaflet.js',
            format: 'amd',
            amd: {id: 'leaflet'},
        },
        plugins: [resolve(), commonjs()],
    },
    {
        input: 'node_modules/leaflet-draw/dist/leaflet.draw-src.js',
        output: {
            file: 'build/assets/lib/leaflet-draw.js',
            format: 'amd',
            amd: {id: 'leaflet-draw'},
        },
        plugins: [
            resolve(),
            commonjs(),
            {
                name: 'add-leaflet-dependency',
                renderChunk(code) {
                    return code.replace(
                        "define('leaflet-draw', (function () {",
                        "define('leaflet-draw', ['leaflet'], (function (L) {"
                    );
                },
            },
        ],
        external: ['leaflet'],
    },
];
