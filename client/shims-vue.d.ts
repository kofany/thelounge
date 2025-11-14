// https://vuejs.github.io/vetur/guide/setup.html#vue3
declare module "*.vue" {
    import type {DefineComponent} from "vue";
    const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>;
    export default component;
}
