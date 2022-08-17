import { Box, Flex, Image, Stack, Tag, Text, Link, FormLabel, Input, InputGroup, Button, TableContainer, Table, TableCaption, Thead, Tr, Th, Tbody, Td, Tfoot } from "@chakra-ui/react";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData, useTransition, useNavigate } from "@remix-run/react";
import { oAuthStrategy } from "~/lib/storage/auth.server";
import { supabaseAdmin } from "~/lib/storage/supabase.server";
import { useEffect, useState, } from "react";


export const loader: LoaderFunction = async ({ request, params }) => {

    const session = await oAuthStrategy.checkSession(request, {
        failureRedirect: "/",
    });

    const page = params.page;

    if (!page) {
        return json({
            status: 'error',
            message: 'No page specified',
        });
    }

    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("plan")
        .eq('id', session.user?.id)
        .single()

    const { data: siteData } = await supabaseAdmin
        .from('sites')
        .select('*')
        .eq('id', page)
        .eq('owner', session.user?.id)
        .single()

    if (!siteData) {
        return json({
            status: 'error',
            message: 'Page not found',
        });
    }

    return json({ siteData, userData });
};


export const action: ActionFunction = async ({ request, params }) => {

    const session = await oAuthStrategy.checkSession(request, {
        failureRedirect: "/",
    });

    const formData = await request.formData();
    const siteName = formData.get('site_name');

    if (!siteName) {
        return json({
            status: 'error',
            message: 'No site name specified',
        });
    }

    const { data, error } = await supabaseAdmin
        .from('sites')
        .update({ site_name: siteName })
        .eq('owner', session.user?.id)
        .eq('id', params.page)

    if (error) {
        return json({
            status: 'error',
            message: error.message,
        });
    }

    return json({ status: 'success' });
};


export default function Settings() {

    const { siteData: page, userData } = useLoaderData()
    const [subdomain, setSubdomain] = useState(page.site_name)
    const nav = useNavigate();

    const actionData = useActionData();
    const siteNameAvailable = useFetcher()
    const customDomainAction = useFetcher()
    const checkCustomDomain = useFetcher()
    let [siteNameValid, setSiteNameValid] = useState(false)
    let [nameCheckCount, setNameCheckCount] = useState(0)
    let [input, setInput] = useState(page.site_name)
    let [customDomain, setCustomDomain] = useState(page.custom_domain ? page.custom_domain : '')
    let [inputError, setInputError] = useState('')
    const transition = useTransition();

    const isSubmitting = transition.state === 'submitting'
    let isSaved = actionData ? actionData.status === 'success' : false;

    let customDomainStatus = customDomainAction.data ? customDomainAction.data.status : '';

    const handleNameCheck = async (value: any) => {

        value = value.toLowerCase()

        if (value.length < 3) {
            return setInputError('Subdomain must be at least 3 characters')
        }

        function regTest(str: string) {
            return /^[A-Za-z0-9]*$/.test(str)
        }

        if (regTest(value) && value != '') {
            setInputError('')
            siteNameAvailable.submit(
                { some: value },
                { method: "post", action: "/auth/valid-name" }
            );
        } else {
            setNameCheckCount(nameCheckCount + 1)
            setSiteNameValid(false)
            setInputError('Subdomain name invalid a-z 0-9 only! (no spaces)')
        }

    }

    useEffect(() => {
        if (siteNameAvailable.type === "done" && siteNameAvailable.data.nameFree) {
            setNameCheckCount(nameCheckCount + 1)
            setSiteNameValid(true)
        } else if (siteNameAvailable.type === "done" && !siteNameAvailable.data.nameFree) {
            setNameCheckCount(nameCheckCount + 1)
            if (input != subdomain) {
                setSiteNameValid(false)
            } else {
                setSiteNameValid(true)
            }
        }
    }, [siteNameAvailable]);

    useEffect(() => {
        //check if domain is configured correctly
        console.log('checking custom domain')

        if (page.custom_domain) {
            checkCustomDomain.submit(
                { domain: page.custom_domain },
                { method: "post", action: "/api/check-domain" }
            );

        }
    }, [customDomainStatus]);

    const customDomainConfigured = checkCustomDomain.data ? checkCustomDomain.data.valid ? true : false : false

    const addCustomDomain = async (value: any) => {
        const formData = new FormData();
        formData.append("site", page.id);
        formData.append("domain", value);

        customDomainAction.submit(
            formData,
            { method: "post", action: "/api/domain" }
        );
    }

    const removeCustomDomain = async (value: any) => {

        const formData = new FormData();
        formData.append("site", page.id);
        formData.append("domain", value);

        customDomainAction.submit(
            formData,
            { method: "delete", action: "/api/domain" }
        );
    }


    return (
        <Box bg={'box'} width={'full'} mt={10} p={{ base: 2, md: 10 }} rounded={'lg'}>
            <Flex mb={5}>
                <Button onClick={() => nav(`/account`)} >Back</Button>
            </Flex>
            <Flex>
                <Box position={'relative'} border={'1px'} borderColor={'gray.300'} rounded={'lg'} p={4} maxH={'full'} maxWidth={'full'} cursor={'pointer'}>
                    <Flex justify={'flex-end'} display={page.published ? 'flex' : 'none'} >
                        <Tag colorScheme={'green'} position={'absolute'} top={'2%'} right={'2%'} zIndex={100}>{page.published ? 'Live' : null}</Tag>
                    </Flex>
                    <Stack>
                        <Stack>
                            <Box rounded={'md'} overflow={'hidden'} maxH={{ base: '250px', md: '180px' }}>
                                <Image src={page.cover ? page.cover : 'https://images.unsplash.com/photo-1554147090-e1221a04a025?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=848&q=80'} />
                            </Box>
                        </Stack>
                        <Flex justify={'center'} bg={'gray.200'} rounded={'md'} pb={1} pt={1}>
                            <Link href={`https://${page.site_name}.blotion.com`} isExternal>
                                <Text key={page.id}>https://{input}.blotion.com</Text>
                            </Link>
                        </Flex>
                    </Stack>
                </Box>
            </Flex>
            <Flex mt={5} direction={'column'}>
                <Form method='post' autoComplete="false">
                    <FormLabel>Subdomain</FormLabel>
                    <InputGroup gap={2}>
                        <Input value={input} name={'site_name'} isInvalid={nameCheckCount > 0} errorBorderColor={!siteNameValid ? "red.500" : "green.400"}
                            onChange={(e: any) => setInput(e.target.value)} pattern={"[0-9a-zA-Z_.-]*"} onBlur={(e: any) => handleNameCheck(e.target.value)} />
                        <Button type={'submit'} isDisabled={!siteNameValid} isLoading={isSubmitting}>Save</Button>
                    </InputGroup>
                </Form>
                <Text fontSize={'sm'} color={'red.400'} paddingLeft={2} paddingTop={1} paddingBottom={1} display={!siteNameValid && nameCheckCount > 0 ? 'flex' : 'none'}>{inputError === '' ? 'Site name already taken, try a different name.' : null}</Text>
                <Text fontSize={'sm'} color={'red.400'} paddingLeft={2} paddingTop={1} paddingBottom={1} display={inputError !== '' ? 'flex' : 'none'}>{inputError}</Text>
            </Flex>

            <Flex mt={5} direction={'column'}>
                <FormLabel>Custom Domain</FormLabel>
                <InputGroup gap={2}>
                    <Input placeholder="your domain" name={'custom_domain'} value={customDomain} onChange={(e: any) => setCustomDomain(e.target.value)} />
                    {!page.custom_domain ?
                        <Button type={'submit'} colorScheme={'blue'} isDisabled={!customDomain} onClick={() => addCustomDomain(customDomain)} isLoading={isSubmitting} >Add</Button> :
                        <Button type={'submit'} colorScheme={'red'} isDisabled={!customDomain} onClick={() => removeCustomDomain(customDomain)} isLoading={isSubmitting} >Remove</Button>}
                </InputGroup>
                <Flex direction={'column'} align={'center'} mt={3} display={customDomainConfigured ? 'flex' : 'none'}>
                    <Text color={'green.400'}>Domain is successfully configured</Text>
                    <Text color={'green.400'}>Please allow 48hr for DNS changes to take effect</Text>
                </Flex>
            </Flex>

            {page.custom_domain && !customDomainConfigured ?
                <Flex direction={'column'} mt={5}>
                    <TableContainer>
                        <Table variant='simple'>
                            <TableCaption>Set the above record on your DNS provider to continue</TableCaption>
                            <Thead>
                                <Tr>
                                    <Th>Type</Th>
                                    <Th>Name</Th>
                                    <Th>Value</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                <Tr>
                                    <Td>A</Td>
                                    <Td>@</Td>
                                    <Td>76.76.21.21</Td>
                                </Tr>
                            </Tbody>
                        </Table>
                    </TableContainer>
                </Flex>
                : null}
        </Box>
    )
}