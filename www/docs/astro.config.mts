import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel'
import * as TypedocPlugin from './src/plugins/typedoc'
import * as CliPlugin from './src/plugins/cli'
import { cpSync } from 'fs'
import starlightLinksValidator from 'starlight-links-validator'

if (process.env.CI && process.env.RUNNER_OS === 'Windows') {
  console.log(
    'Skipping astro in CI on Windows because it only needs to be run for linting but not tests',
  )
  process.exit(0)
}

const MIXPANEL_TOKEN = '7853b372fb0f20e238be6d11e53f60fe'

export default defineConfig({
  site: 'https://docs.khulnasoft.com',
  trailingSlash: 'never',
  integrations: [
    starlight({
      head: [
        {
          tag: 'script',
          content:
            '(function (f, b) { if (!b.__SV) { var e, g, i, h; window.mixpanel = b; b._i = []; b.init = function (e, f, c) { function g(a, d) { var b = d.split("."); 2 == b.length && ((a = a[b[0]]), (d = b[1])); a[d] = function () { a.push([d].concat(Array.prototype.slice.call(arguments, 0))); }; } var a = b; "undefined" !== typeof c ? (a = b[c] = []) : (c = "mixpanel"); a.people = a.people || []; a.toString = function (a) { var d = "mixpanel"; "mixpanel" !== c && (d += "." + c); a || (d += " (stub)"); return d; }; a.people.toString = function () { return a.toString(1) + ".people (stub)"; }; i = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split( " "); for (h = 0; h < i.length; h++) g(a, i[h]); var j = "set set_once union unset remove delete".split(" "); a.get_group = function () { function b(c) { d[c] = function () { call2_args = arguments; call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); a.push([e, call2]); }; } for ( var d = {}, e = ["get_group"].concat( Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++) b(j[c]); return d; }; b._i.push([e, f, c]); }; b.__SV = 1.2; e = f.createElement("script"); e.type = "text/javascript"; e.async = !0; e.src = "undefined" !== typeof MIXPANEL_CUSTOM_LIB_URL ? MIXPANEL_CUSTOM_LIB_URL : "file:" === f.location.protocol && "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//) ? "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js" : "//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"; g = f.getElementsByTagName("script")[0]; g.parentNode.insertBefore(e, g); } })(document, window.mixpanel || []);',
        },
        {
          tag: 'script',
          // We use autocapture everywhere else but I think we need track_pageview here because its not a SPA
          content: `mixpanel.init("${MIXPANEL_TOKEN}", { autocapture: true, track_pageview: true });`,
        },
      ],
      expressiveCode: {
        themes: ['aurora-x', 'catppuccin-latte'],
        defaultProps: {
          wrap: true,
          preserveIndent: true,
        },
      },
      title: 'NRZ',
      social: {
        linkedin: 'https://www.linkedin.com/company/nrz',
        twitter: 'https://twitter.com/nrz',
        github: 'https://github.com/khulnasoft/nrz',
        discord: 'https://discord.gg/nrz',
      },
      components: {
        Header: './src/components/header/astro-header.astro',
        Sidebar: './src/components/sidebar/astro-app-sidebar.astro',
        PageFrame:
          './src/components/page-frame/astro-page-frame.astro',
        ContentPanel:
          './src/components/content-panel/astro-content-panel.astro',
        PageTitle:
          './src/components/page-title/astro-page-title.astro',
        Pagination:
          './src/components/pagination/astro-pagination.astro',
        PageSidebar:
          './src/components/page-sidebar/astro-page-sidebar.astro',
        TwoColumnContent:
          './src/components/two-column-layout/astro-two-column-layout.astro',
        Hero: './src/components/hero/astro-hero.astro',
        Footer: './src/components/footer/astro-footer.astro',
        ThemeSelect:
          './src/components/theme-select/astro-theme-select.astro',
      },
      customCss: ['./src/styles/globals.css'],
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 5,
      },
      plugins: [
        TypedocPlugin.plugin,
        CliPlugin.plugin,
        starlightLinksValidator({
          // work around bug in the link validator that strips
          // the index off of the last segment. Remove when this PR lands:
          // https://github.com/HiDeoo/starlight-links-validator/pull/80
          exclude: ['/packages/*/module_index?(#*)'],
        }),
      ],
      sidebar: [
        {
          label: 'CLI',
          autogenerate: { directory: CliPlugin.directory },
        },
        {
          label: 'Packages',
          collapsed: true,
          autogenerate: { directory: TypedocPlugin.directory },
        },
        {
          label: 'Serverless Registry',
          link: 'https://www.khulnasoft.com/serverless-registry',
        },
      ],
    }),
    react(),
    tailwind({ applyBaseStyles: false }),
    // astro v5 and the vercel adapter don't play well with
    // content that is generated after the build such as the
    // pagefind JS. So we copy it manually.
    // https://github.com/withastro/adapters/issues/445
    {
      name: 'copy-pagefind',
      hooks: {
        'astro:build:done': async () => {
          cpSync(
            'dist/pagefind',
            './.vercel/output/static/pagefind',
            {
              recursive: true,
            },
          )
        },
      },
    },
  ],
  output: 'static',
  adapter: vercel(),
})
