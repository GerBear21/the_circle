import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
    return {
        redirect: {
            destination: '/requests/all',
            permanent: false,
        },
    };
};

export default function RequestsIndex() {
    return null;
}
