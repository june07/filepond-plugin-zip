import JSZip from 'jszip'

let zipped = {}

async function generateFileIdentifier(file) {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)

    // Convert the hash buffer to a hexadecimal string
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('')

    return hashHex
}

const plugin = (params) => {
    const { addFilter, utils } = params
    const { Type, isFile, createRoute, text, toNaturalFileSize } = utils

    addFilter(
        'SHOULD_PREPARE_OUTPUT',
        (_, { item, query }) => new Promise(async (resolve) => {
            const { file } = item

            if (query('GET_ALLOW_FILE_ZIP') && file.type === 'application/zip') {
                return resolve(false)
            }
            resolve(query('GET_ALLOW_FILE_ZIP'))
        })
    )

    addFilter(
        'PREPARE_OUTPUT',
        (file, { item }) =>
            new Promise(async (resolve, reject) => {
                const fileId = await generateFileIdentifier(file)
                if (zipped[fileId]) {
                    return resolve(zipped[fileId])
                }
                // if it's not a file, continue
                if (!isFile(file)) {
                    return resolve(item)
                }

                const zip = new JSZip()

                // Add the file directly to the root of the zip
                zip.file(file.name, file)

                try {
                    // Generate the zip file
                    const content = await zip.generateAsync({
                        type: 'blob',
                        compression: 'DEFLATE',
                        compressionOptions: {
                            level: 9,
                        },
                    })
                    zipped[fileId] = new File([content], `${file.name}.zip`, { type: 'application/zip' })
                    item.setMetadata('fileSize', zipped[fileId].size)
                    resolve(zipped[fileId])
                } catch (error) {
                    console.error('Error creating zip file:', error)
                    reject(error)
                }
            })
    )

    addFilter('CREATE_VIEW', viewAPI => {
        const { view, query } = viewAPI

        if (!query('GET_ALLOW_FILE_ZIP')) {
            return
        }

        view.registerWriter(
            createRoute({
                REQUEST_PREPARE_OUTPUT: ({ root, action }) => {
                    const item = query('GET_ITEM', action.id)
                    if (!item) return

                    if (root.ref.file?.element) {
                        const el = root.ref.file.element.querySelector('.filepond--file-status-main')
                        const el2 = root.ref.file.element.querySelector('.filepond--file-info-sub')
                        text(el, `${el.innerText.replace('Loading', 'Zipping')}`)
                        text(el2, toNaturalFileSize(
                            item.fileSize,
                            '.',
                            root.query('GET_FILE_SIZE_BASE'),
                            root.query('GET_FILE_SIZE_LABELS', root.query)
                        ))
                    }
                },
                DID_PREPARE_OUTPUT: ({ root, action }) => {
                    const item = query('GET_ITEM', action.id)
                    if (!item) return

                    if (root.ref.file?.element) {
                        const el = root.ref.file.element.querySelector('.filepond--file-info-sub')
                        const compressedSize = toNaturalFileSize(
                            action.file.size,
                            '.',
                            root.query('GET_FILE_SIZE_BASE'),
                            root.query('GET_FILE_SIZE_LABELS', root.query)
                        )
                        const uncompressedSize = toNaturalFileSize(
                            item.file.size,
                            '.',
                            root.query('GET_FILE_SIZE_BASE'),
                            root.query('GET_FILE_SIZE_LABELS', root.query)
                        )
                        text(el, `${compressedSize} [${uncompressedSize}]`)
                    }
                }
            })
        )
    })

    return {
        options: {
            allowFileZip: [true, Type.BOOLEAN]
        },
    }
}

// fire pluginloaded event if running in browser, this allows registering the plugin when using async script tags
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'
if (isBrowser) {
    document.dispatchEvent(new CustomEvent('FilePond:pluginloaded', { detail: plugin }))
}

export default plugin