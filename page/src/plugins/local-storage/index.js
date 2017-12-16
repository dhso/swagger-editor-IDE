import PetstoreYaml from "./petstore"
const CONTENT_KEY = "swagger-editor-content"

let localStorage = window.localStorage

export const updateSpec = (ori) => (...args) => {
  let [spec] = args
  ori(...args)
  saveContentToStorage(spec)
}

export default function(system) {
  // setTimeout runs on the next tick
  setTimeout(() => {
    if (localStorage.getItem(CONTENT_KEY)) {
      system.specActions.updateSpec(localStorage.getItem(CONTENT_KEY))
    } else {
      system.specActions.updateSpec(PetstoreYaml)
    }
  }, 0)
  return {
    statePlugins: {
      spec: {
        wrapActions: {
          updateSpec
        }
      }
    }
  }
}

function saveContentToStorage(str) {
  return localStorage.setItem(CONTENT_KEY, str)
}